import {SCORE, semitone} from './score.js';

const MAX_VOICES = 16;
const MAX_MUSIC = 10;
const FADE = 1.15;
const SCENE_HOLD = .34;

function target(param, value, time, fade) {
  param.cancelScheduledValues(time);
  param.setTargetAtTime(value,time,fade);
}

export class Sound {
  constructor() {
    this.voices=new Set();
    this.scene=-1;
    this.candidate=-1;
    this.nextPulse=0;
    this.pulse=0;
    this.tension=0;
  }

  start() {
    if(!this.ctx) {
      const Audio=window.AudioContext || window.webkitAudioContext;
      if(!Audio) return;
      try {this.ctx=new Audio();} catch {return;}
      const ctx=this.ctx;
      this.music=ctx.createGain();
      this.effects=ctx.createGain();
      this.master=ctx.createGain();
      this.master.gain.value=.78;
      this.music.gain.value=0;
      this.effects.gain.value=0;
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.master.connect(ctx.destination);
      this.tracks=SCORE.map(()=> {
        const output=ctx.createGain();
        const filter=ctx.createBiquadFilter();
        filter.type='lowpass';
        output.gain.value=0;
        filter.connect(output).connect(this.music);
        return {output,filter,phrase:0,step:0,next:0};
      });
      this.threat=ctx.createGain();
      this.threat.gain.value=0;
      this.threat.connect(this.music);
    }
    if(this.ctx.state!=='running') this.ctx.resume().catch(()=>{});
  }

  update(settings, playing, scene=0, danger=0, low=false) {
    if(!this.ctx) return;
    const t=this.ctx.currentTime;
    const music=playing && !settings.mute ? settings.music/100 : 0;
    const effects=settings.mute ? 0 : settings.effects/100;
    if(music!==this.musicLevel) {
      target(this.music.gain,music,t,music?.24:.045);
      this.musicLevel=music;
      if(!music) this.stopMusic(t);
    }
    if(effects!==this.effectsLevel) {
      target(this.effects.gain,effects,t,.035);
      this.effectsLevel=effects;
    }
    if(!music || this.ctx.state!=='running') return;
    if(scene!==this.candidate) {
      this.candidate=scene;
      this.switchAt=t+SCENE_HOLD;
    }
    if(this.scene<0 || (scene!==this.scene && t>=this.switchAt)) this.switchScene(scene,t);
    if(t>=this.nextMeasure) this.scoreStep(t,low);
    if(t>=this.nextPulse) {
      this.nextPulse=t+2.15;
      // Solo se refuerzan amenazas que el juego ya ha señalado.
      const level=Math.max(0,(danger-.18)*1.18);
      this.tension+=(level-this.tension)*(level>this.tension?.58:.78);
      target(this.threat.gain,this.tension,t,.65);
      if(this.tension>.065 && (this.pulse++%4)!==2) {
        this.tone(42+(this.pulse%3)*4,'triangle',1.25,.13,.76,this.threat,{attack:.18});
      }
    }
  }

  resetScore() {
    if(this.ctx) this.stopMusic(this.ctx.currentTime);
    if(this.tracks) for(const track of this.tracks) {
      track.phrase=0;track.step=0;
    }
    this.pulse=0;
  }

  stopMusic(t) {
    this.scene=-1;
    this.candidate=-1;
    this.tension=0;
    this.nextPulse=t;
    target(this.threat.gain,0,t,.08);
    for(const track of this.tracks) target(track.output.gain,0,t,.08);
    for(const voice of this.voices) if(voice.music) voice.osc.stop(t+.16);
  }

  switchScene(index,t) {
    this.tracks.forEach((track,i)=>target(track.output.gain,i===index?1:0,t,FADE));
    this.scene=index;
    this.nextMeasure=t;
  }

  scoreStep(t,low) {
    const track=this.tracks[this.scene], score=SCORE[this.scene];
    const phrase=score.phrases[track.phrase%score.phrases.length];
    const step=track.step, turn=track.phrase;
    const shift=[0,.13,-.19,.31][turn%4];
    const root=semitone(score.root,shift);
    target(track.filter.frequency,score.drift*(low?.77:1)*(1+.19*Math.sin(turn*1.8+step*.37)),t,.7);
    if(step===0) {
      for(const [i,note] of score.drone.entries()) {
        this.tone(semitone(root,note),i?score.wave:'sine',score.step*(i?3.7:5.2),i?.043:.089,
          i?1.009:.994,track.filter,{attack:i?2.3:1.35,pan:i?.32:-.19});
      }
    }
    if(phrase[step]!==null) {
      const hz=semitone(root,phrase[step]+12);
      this.tone(hz,score.wave,score.step*(this.scene===2?1.32:.81),.085,.985,track.filter,
        {attack:this.scene===1?.06:.39,pan:.42*Math.sin(turn+step*1.7)});
    }
    track.step++;
    if(track.step===phrase.length) {track.step=0;track.phrase++;}
    this.nextMeasure=t+score.step*(1+.055*Math.sin(step*1.1+turn));
  }

  tone(hz,type,duration,volume,end=1,channel=this.effects,{attack=.015,pan=0,delay=0}={}) {
    if(!this.ctx || this.ctx.state!=='running' || this.voices.size>=MAX_VOICES) return;
    const music=channel!==this.effects;
    if(music && [...this.voices].filter(v=>v.music).length>=MAX_MUSIC) return;
    if(!music && !this.effectsLevel) return;
    const t=this.ctx.currentTime+delay, osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
    const panner=pan && this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    osc.type=type;
    osc.frequency.setValueAtTime(hz,t);
    osc.frequency.exponentialRampToValueAtTime(hz*end,t+duration);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+attack);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);
    if(panner) {panner.pan.value=pan;gain.connect(panner).connect(channel);}
    else gain.connect(channel);
    const voice={osc,music};
    this.voices.add(voice);
    osc.onended=()=> {
      osc.disconnect();gain.disconnect();panner?.disconnect();
      this.voices.delete(voice);
    };
    osc.start(t);
    osc.stop(t+duration+.03);
  }

  discovery() {
    if(!this.musicLevel || this.scene<0) return;
    for(const [i,note] of [0,5.2,16.1].entries()) {
      this.tone(semitone(149,note),i===1?'triangle':'sine',1.65,.078,.998,this.music,
        {delay:i*.34,attack:.15,pan:(i-1)*.25});
    }
  }

  event(name,tone=150) {
    if(name==='mine') this.tone(tone,'triangle',.14,.24,.42);
    if(name==='place') this.tone(tone*.7,'sine',.15,.32,.62);
    if(name==='step') this.tone(tone,'triangle',.058,.08,.51);
    if(name==='hurt') this.tone(102,'sine',.4,.32,.43);
    if(name==='charge') this.tone(112,'triangle',.43,.13,.6);
    if(name==='creature') this.tone(73,'triangle',.48,.19,1.68);
    if(name==='craft' || name==='echo') {
      this.tone(name==='echo'?196:392,'sine',.69,.22,1.5);
      this.tone(name==='echo'?293:584,'triangle',.49,.09,1.26);
    }
  }
}

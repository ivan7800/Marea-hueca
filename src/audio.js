export class Sound {
  constructor() {
    this.voices=[];
    this.next=0;
    this.beat=0;
    this.activeTones=0;
  }

  start() {
    if(!this.ctx) {
      const Audio=window.AudioContext || window.webkitAudioContext;
      if(!Audio) return;
      let ctx;
      try {ctx=new Audio();} catch {return;}
      this.ctx=ctx;
      this.music=ctx.createGain();
      this.effects=ctx.createGain();
      this.filter=ctx.createBiquadFilter();
      this.filter.type='lowpass';
      this.filter.frequency.value=510;
      this.master=ctx.createGain();
      this.music.connect(this.filter).connect(this.master);
      this.effects.connect(this.master).connect(ctx.destination);
      this.music.gain.value=0;
      this.effects.gain.value=0;
      for(let i=0;i<3;i++) {
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.type=i===1?'sawtooth':'sine';
        o.frequency.value=[55,82.4,110][i];
        g.gain.value=[.14,.029,.036][i];
        o.connect(g).connect(this.music);
        o.start();
        this.voices.push(o);
      }
    }
    this.ctx.resume().catch(()=>{});
  }

  update(settings,pitch,danger,playing,deep=false) {
    if(!this.ctx) return;
    const t=this.ctx.currentTime;
    const silence=settings.mute?0:1;
    this.music.gain.setTargetAtTime(playing?settings.music/100*silence:0,t,.36);
    this.effects.gain.setTargetAtTime(settings.effects/100*silence,t,.06);
    this.filter.frequency.setTargetAtTime((deep?170:260)+danger*490,t,.9);
    const ratios=[1,1.497+danger*.025,2.008];
    for(let i=0;i<this.voices.length;i++) this.voices[i].frequency.setTargetAtTime(pitch*ratios[i],t,1.2);
    if(playing && t>this.next && silence && settings.music) {
      const notes=deep?[1,0,1.414,0,1.061,0,0,2]:[1,0,2.01,1.497,0,1.067,0,2.12];
      const note=notes[this.beat++%notes.length];
      if(note) this.tone(pitch*note,'triangle',.72,.1+danger*.06,.49,this.music);
      this.next=t+(deep?2.4:1.85)-danger*.95;
    }
  }

  tone(hz,type,duration,volume,end=1,channel=this.effects) {
    if(!this.ctx || this.ctx.state!=='running' || this.activeTones>=12) return;
    this.activeTones++;
    const t=this.ctx.currentTime, osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(hz,t);
    osc.frequency.exponentialRampToValueAtTime(hz*end,t+duration);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+.015);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain).connect(channel);
    osc.start(t);
    osc.stop(t+duration+.03);
    osc.onended=()=> {osc.disconnect();gain.disconnect();this.activeTones--;};
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

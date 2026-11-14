// Cada frase tiene silencios escritos y una duración distinta por zona.
// Las notas se expresan en semitonos respecto a su propia fundamental.
export const SCORE = [
  {name:'Donde rompe el junco', root:52, step:1.7, drift:390,
    drone:[0,7.04], wave:'triangle', phrases:[
      [0,null,null,14,null,5,null,null],
      [0,null,12,null,null,3,null,null,null],
      [7,null,null,14,null,null,null]
    ]},
  {name:'La vértebra de basalto', root:43.6, step:1.28, drift:270,
    drone:[0,13.09], wave:'sawtooth', phrases:[
      [0,6,null,null,-2,null,null],
      [0,null,13,6,null,null,1,null,null],
      [-2,null,null,0,null,8,null,null]
    ]},
  {name:'Sedimento de luz', root:63.2, step:2.05, drift:620,
    drone:[0,18.98], wave:'sine', phrases:[
      [19,null,11,null,null,23,null],
      [16,null,null,23,9,null,null,null],
      [11,17,null,null,null,19,null,null]
    ]},
  {name:'El peso del agua ausente', root:39.4, step:2.42, drift:192,
    drone:[0,6.95], wave:'triangle', phrases:[
      [null,13,null,null,6,null,null,1,null],
      [null,null,18,null,-3,null,null],
      [6,null,null,null,13,null,null,0,null,null]
    ]}
];

export const semitone = (root, note) => root * 2 ** (note / 12);

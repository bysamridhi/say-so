// The four "days" of the probe — exact wording carried over from the original Google Forms.
// Shared by the page (public/index.html) and the server (lib/probe.js) so there is one source of truth.
export const DAYS = [
  { key:'d1', label:'DAY 1', title:'Finish the Sentence', blurb:'Half-sentences people grow up hearing. Finish them your way.',
    prompts:[
      {id:'d1_q1', type:'text', q:'“A good girl never ___”', ph:'A good girl never…'},
      {id:'d1_q2', type:'text', q:'“A girl who laughs like that ___”', ph:'…'},
      {id:'d1_q3', type:'text', q:'“A girl who talks back ___”', ph:'…'},
      {id:'d1_q4', type:'text', q:'“A girl with a mark or tattoo like that ___”', ph:'…'},
      {id:'d1_q5', type:'text', q:'“A girl who dresses like that ___”', ph:'…'},
      {id:'d1_q6', type:'text', q:'“At least she\u2019s ___”', ph:'…'},
      {id:'d1_q7', type:'text', q:'Which of these do you hear most often?', sub:'Type the first few words.', ph:'e.g. a good girl never…'},
      {id:'d1_q8', type:'chips', q:'Who usually says lines like these?', sub:'Pick any that fit.', multi:true,
        options:['A parent','A grandparent','Another relative','A neighbour','A teacher','A friend']},
      {id:'d1_q9', type:'text', q:'If these sentences had a sound, what would it be?', ph:'e.g. a slammed door, a sigh…'},
      {id:'d1_q10', type:'text', q:'Anything else you want to add?', ph:'(optional)', optional:true}
    ]},
  { key:'d2', label:'DAY 2', title:"Who's in Your Head", blurb:'The person or crowd you picture judging you before you do something.',
    prompts:[
      {id:'d2_q1', type:'text', q:'Think of the person, or the crowd, whose opinion you imagine when you decide something, like what to wear, say or do.', sub:'A relative, a neighbour, “society,” someone you\u2019ve never met — describe them in a sentence or two.', ph:'e.g. my aunt, a stranger, my own voice…'},
      {id:'d2_q2', type:'chips', q:'Are they real, imagined, or a bit of both?', multi:false,
        options:['Real','Imagined','A bit of both']},
      {id:'d2_q3', type:'text', q:'Do they have a face, a voice, or a place?', sub:'Describe what you imagine.', ph:'…'},
      {id:'d2_q4', type:'chips', q:'When do they show up most?', sub:'Tick any.', multi:true,
        options:['When I dress','When I make plans','At weddings and gatherings','Online']}
    ]},
  { key:'d3', label:'DAY 3', title:'The Route of a Rule', blurb:'One rule, traced back as far as you can take it.',
    prompts:[
      {id:'d3_q1', type:'text', q:'Choose any one rule you grew up with about how a girl or woman should look, sound or behave.', sub:'Write it the way it\u2019s usually said.', ph:'e.g. don\u2019t laugh too loud…'},
      {id:'d3_q2', type:'chips', q:'Is it mostly about her body, her voice, or both?', multi:false,
        options:['Body','Voice','Both','Not sure']},
      {id:'d3_q3', type:'text', q:'Where do you think it came from?', sub:'Trace the path using roles, not names — “my grandmother \u2192 my mother \u2192 me.” If you don\u2019t know, write where the path stops.', ph:'…'},
      {id:'d3_q4', type:'text', q:'Was a reason ever given?', sub:'“No reason was given” is a complete answer.', ph:'…'},
      {id:'d3_q5', type:'text', q:'Who does this rule help, and who does it cost?', sub:'“Nobody” or “I don\u2019t know” is fine.', ph:'…'},
      {id:'d3_q6', type:'text', q:'If this rule were an object, what would it be?', ph:'e.g. a locked door, a ball, a radio…'}
    ]},
  { key:'d4', label:'DAY 4', title:'A Rule That Bent', blurb:'A rule that loosened over time — and what actually moved it.',
    prompts:[
      {id:'d4_q1', type:'text', q:'Think of a rule in your family, or one you know about, that loosened over time.', sub:'What was the rule, and for whom?', ph:'…'},
      {id:'d4_q2', type:'chips', q:'What do you think changed it?', sub:'Tick any.', multi:true,
        options:['Time passing','Someone argued','Someone stopped caring','A wedding or other event','Someone from outside the family','It just changed, no reason given']},
      {id:'d4_q3', type:'text', q:'What did girls or women do in the meantime, while the rule was still there?', ph:'…'},
      {id:'d4_q4', type:'chips', q:'Some people call rules like these \u201Cpatriarchy.\u201D Does that word fit the way you see it?', multi:false,
        options:['It fits','It partly fits','It doesn\u2019t fit','I\u2019ve never heard it used']},
      {id:'d4_q5', type:'text', q:'What word would you use, at home or with friends?', ph:'…'},
      {id:'d4_q6', type:'text', q:'Anything you\u2019d like to add or take back?', ph:'(optional)', optional:true}
    ]}
];

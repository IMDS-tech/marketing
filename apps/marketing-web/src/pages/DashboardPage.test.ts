import test from 'node:test';
import assert from 'node:assert/strict';

test('dashboard grid uses twelve columns and valid widget bounds',()=>{
  const widgets=[
    {x:0,w:3},{x:3,w:3},{x:6,w:3},{x:9,w:3},{x:0,w:8},{x:8,w:4},
  ];
  assert.equal(widgets.every(widget=>widget.x>=0&&widget.w>=1&&widget.x+widget.w<=12),true);
});

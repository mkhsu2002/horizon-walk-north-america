import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const preview = new URL('../web/app-preview/index.html', import.meta.url);
const markup = readFileSync(preview, 'utf-8');
const home = readFileSync(new URL('../web/index.html', import.meta.url), 'utf-8');

test('static App Preview is discoverable without replacing any playable entry', () => {
  assert.match(home, /<a\b[^>]*href="app-preview\/"[^>]*>App Preview<\/a>/);
  for (const id of ['hero-demo', 'hero-manual', 'mode-demo', 'manual-form', 'passport']) {
    assert.ok(home.includes('id="' + id + '"'), id);
  }
  assert.match(markup, /rel="canonical" href="https:\/\/walk\.horizonoutdoor\.ca\/app-preview\/"/);
  assert.match(markup, /href="\.\.\/#mode-demo">Try the web demo/);
  for (const ref of markup.matchAll(/(?:src|href)="((?:\.\.\/)?[^"/:#][^":#]*\.(?:png|webp|css))"/g)) {
    assert.ok(existsSync(new URL(ref[1], preview)), ref[1]);
  }
});

test('three illustrated screens communicate the plan without requesting permissions or collecting data', () => {
  assert.equal((markup.match(/class="screen-label">Illustrative screen</g) ?? []).length, 3);
  for (const text of [/App preview · in development/i, /All screen data is illustrative/, /Optional · Not connected/, /Put the phone away/, /Example sync/, /North Lawndale/, /no app download yet/, /do not access Health Connect or read health data/]) {
    assert.match(markup, text);
  }
  assert.doesNotMatch(markup, /<(?:script|form|input|button|iframe|svg)\b/i);
  assert.doesNotMatch(markup, /src="https?:\/\//);
});

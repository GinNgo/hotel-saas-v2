import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveInitialTheme,
  computeNextTheme,
  buildThemeDomState
} from './theme.utils';

test('resolveInitialTheme prioritizes valid persisted theme values', () => {
  assert.equal(resolveInitialTheme('dark', false), 'dark');
  assert.equal(resolveInitialTheme('light', true), 'light');
});

test('resolveInitialTheme falls back to system preference or light mode when storage is empty/invalid', () => {
  assert.equal(resolveInitialTheme(null, true), 'dark');
  assert.equal(resolveInitialTheme(null, false), 'light');
  assert.equal(resolveInitialTheme('invalid-value', false), 'light');
});

test('computeNextTheme alternates cleanly between light and dark', () => {
  assert.equal(computeNextTheme('light'), 'dark');
  assert.equal(computeNextTheme('dark'), 'light');
});

test('buildThemeDomState returns matching body classes and data-theme attributes', () => {
  const darkState = buildThemeDomState('dark');
  assert.equal(darkState.dataThemeAttr, 'dark');
  assert.deepEqual(darkState.bodyClassesToAdd, ['dark-theme', 'dark']);
  assert.deepEqual(darkState.bodyClassesToRemove, ['light-theme']);

  const lightState = buildThemeDomState('light');
  assert.equal(lightState.dataThemeAttr, 'light');
  assert.deepEqual(lightState.bodyClassesToAdd, ['light-theme']);
  assert.deepEqual(lightState.bodyClassesToRemove, ['dark-theme', 'dark']);
});

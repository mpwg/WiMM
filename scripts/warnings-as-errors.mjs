// SPDX-License-Identifier: AGPL-3.0-or-later
// NO_COLOR und FORCE_COLOR dürfen nicht gleichzeitig an Kindprozesse gelangen.
if ('NO_COLOR' in process.env) {
  process.env.FORCE_COLOR = '0';
  delete process.env.NO_COLOR;
}
process.on('warning', (warning) => { throw warning; });

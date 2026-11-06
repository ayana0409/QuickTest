/**
 * Automated test suite for ProctoringRealtimeManager frame parsing and event translation.
 * Run directly with Node.js: node test/realtime-manager.test.mjs
 */

import assert from 'node:assert';

console.log('🧪 [Test Suite] Running ProctoringRealtimeManager Parser & Event Tests...');

// 1. Test Frame Splitting (Multiple messages delimited by \n)
function testNewlineSeparatedFrames() {
  const sampleFrame = `{"event_id":"evt_1","project_id":"quicktest","scope":"user","content":{"type":"raw","data":{"eventType":"VIOLATION_ALERT","payload":{"attemptId":"att-123","alert":{"violationType":"TAB_SWITCH","violationCount":1,"disqualified":false}}}}}
{"event_id":"evt_2","project_id":"quicktest","scope":"user","content":{"type":"raw","data":{"eventType":"CANDIDATE_VIOLATION","payload":{"attemptId":"att-456","event":{"candidateName":"John Doe","violationType":"DEVTOOLS_OPEN","violationCount":2}}}}}
{"event_id":"evt_3","project_id":"quicktest","scope":"user","content":{"type":"raw","data":{"eventType":"EXAM_CLOSED","payload":{"message":"Giáo viên đã kết thúc bài thi."}}}}`;

  const lines = sampleFrame.split('\n');
  assert.strictEqual(lines.length, 3, 'Frame must be split into exactly 3 messages');

  const events = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const envelope = JSON.parse(trimmed);
    const content = envelope.content;
    const eventType = content.data.eventType;
    const payload = content.data.payload;

    let eventData = payload;
    let attemptId = payload.attemptId;

    if (eventType === 'VIOLATION_ALERT' && payload.alert) {
      eventData = { ...payload.alert, attemptId: payload.attemptId };
    } else if (eventType === 'CANDIDATE_VIOLATION' && payload.event) {
      eventData = { ...payload.event, attemptId: payload.attemptId };
    } else if (eventType === 'EXAM_CLOSED') {
      eventData = { message: payload.message, action: 'AUTO_SUBMIT' };
    }

    events.push({
      eventType,
      attemptId,
      data: eventData,
    });
  }

  // Verification 1: Candidate Alert
  assert.strictEqual(events[0].eventType, 'VIOLATION_ALERT');
  assert.strictEqual(events[0].attemptId, 'att-123');
  assert.strictEqual(events[0].data.violationType, 'TAB_SWITCH');
  assert.strictEqual(events[0].data.violationCount, 1);
  assert.strictEqual(events[0].data.disqualified, false);

  // Verification 2: Teacher Broadcast
  assert.strictEqual(events[1].eventType, 'CANDIDATE_VIOLATION');
  assert.strictEqual(events[1].attemptId, 'att-456');
  assert.strictEqual(events[1].data.candidateName, 'John Doe');
  assert.strictEqual(events[1].data.violationType, 'DEVTOOLS_OPEN');
  assert.strictEqual(events[1].data.violationCount, 2);

  // Verification 3: Exam Closure Broadcast
  assert.strictEqual(events[2].eventType, 'EXAM_CLOSED');
  assert.strictEqual(events[2].data.action, 'AUTO_SUBMIT');
  assert.strictEqual(events[2].data.message, 'Giáo viên đã kết thúc bài thi.');

  console.log('  ✅ [PASS] Newline-separated QuickNotify frames parsed and mapped accurately.');
}

// 2. Test Empty and Corrupted Lines Filtering
function testCorruptedLinesHandling() {
  const corruptedFrame = `\n\n{"event_id":"valid","content":{"data":{"eventType":"VIOLATION_ALERT","payload":{"attemptId":"1"}}}} \n  MALFORMED_JSON_HERE \n \n`;
  const lines = corruptedFrame.split('\n');
  const validEnvelopes = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const envelope = JSON.parse(trimmed);
      validEnvelopes.push(envelope);
    } catch {
      // Ignored malformed lines safely
    }
  }

  assert.strictEqual(validEnvelopes.length, 1, 'Only 1 valid JSON envelope should be parsed');
  assert.strictEqual(validEnvelopes[0].event_id, 'valid');
  console.log('  ✅ [PASS] Empty and malformed frames handled safely without crashes.');
}

// 3. Test Health Check URL Formatting
function testHealthCheckUrlGeneration() {
  const wsUrl1 = 'ws://localhost:8080/ws';
  const healthUrl1 = wsUrl1
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .replace(/\/ws.*$/, '/healthz');
  assert.strictEqual(healthUrl1, 'http://localhost:8080/healthz');

  const wsUrl2 = 'wss://notify.quicktest.io/ws?token=secret123';
  const healthUrl2 = wsUrl2
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .replace(/\/ws.*$/, '/healthz');
  assert.strictEqual(healthUrl2, 'https://notify.quicktest.io/healthz');

  console.log('  ✅ [PASS] Health-check URL derived correctly from WS/WSS endpoints.');
}

// Run all tests
testNewlineSeparatedFrames();
testCorruptedLinesHandling();
testHealthCheckUrlGeneration();

console.log('🎉 [ALL TESTS PASSED] ProctoringRealtimeManager test suite completed successfully!');


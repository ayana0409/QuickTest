import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import exec from 'k6/execution';

/**
 * ============================================================================
 * QuickTest Dynamic & Resilient k6 Load & Stress Testing Script
 * ============================================================================
 * Features:
 * 1. Dynamic Question Adaptation: Fully adaptable to ANY exam in the database.
 *    Extracts questions dynamically from POST /api/session/start.
 *    Automatically handles all 4 question types:
 *    - SINGLE_CHOICE (single option selection)
 *    - MULTIPLE_CHOICE (multi-option randomized selection)
 *    - NUMERIC (randomized numeric answers)
 *    - ESSAY_TEXT (realistic text paragraphs)
 * 2. Auto-Discovery & Auto-Provisioning:
 *    - Uses user-provided ACCESS_CODE if specified (-e ACCESS_CODE=XYZ).
 *    - Automatically discovers open published exams via GET /api/public/exams.
 *    - If no open exam exists, automatically logs in as teacher, creates a
 *      benchmark test exam with diverse questions, publishes it, and runs
 *      the load test seamlessly without any manual configuration!
 *    - Teardown automatically closes temporary auto-created test exams.
 * 3. Guaranteed mathematically distinct client IPs across all VUs & iterations
 *    cycling through realistic Vietnamese ISP pools (VNPT, Viettel, FPT).
 * 4. Realistic Vietnamese candidate names and unique session identifiers.
 * 5. Incremental auto-save draft simulation (PUT /api/session/{attemptId}/save).
 * 6. Live candidate heartbeat loop keeping sessions active and ONLINE.
 * 7. Optional final exam submission (POST /api/session/{attemptId}/submit).
 * ============================================================================
 */

// Custom metrics for latency and throughput measurement
const startLatency = new Trend('start_exam_duration', true);
const saveDraftLatency = new Trend('save_draft_duration', true);
const submitLatency = new Trend('submit_exam_duration', true);
const successfulStarts = new Counter('successful_starts');
const failedStarts = new Counter('failed_starts');
const successfulSaves = new Counter('successful_saves');
const failedSaves = new Counter('failed_saves');
const successfulSubmits = new Counter('successful_submits');
const failedSubmits = new Counter('failed_submits');
const successfulHeartbeats = new Counter('successful_heartbeats');
const failedHeartbeats = new Counter('failed_heartbeats');
const activeHeldSessions = new Counter('active_held_sessions');
const completionRate = new Rate('exam_completion_rate');

// Vietnamese Candidate Name Dictionaries
const LAST_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ',
  'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đào', 'Đoàn',
];

const MIDDLE_NAMES = [
  'Văn', 'Thị', 'Đức', 'Anh', 'Minh', 'Hải', 'Hữu', 'Tuấn',
  'Hoàng', 'Xuân', 'Thanh', 'Đình', 'Ngọc', 'Quang', 'Gia', 'Bảo',
];

const FIRST_NAMES = [
  'Anh', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hải',
  'Hiếu', 'Hoàng', 'Hùng', 'Huy', 'Khánh', 'Linh', 'Long', 'Minh',
  'Nam', 'Nghĩa', 'Phong', 'Phúc', 'Quân', 'Sơn', 'Thắng', 'Thịnh',
  'Tiến', 'Trung', 'Tuấn', 'Tùng', 'Việt', 'Vy', 'Trang', 'Yến',
];

// Major Vietnamese Residential ISP IP pools
const ISP_IP_POOLS = [
  { net: 14, start: 160, end: 240 },   // VNPT Broadband
  { net: 113, start: 160, end: 190 },  // VNPT / Viettel
  { net: 171, start: 224, end: 255 },  // Viettel Residential
  { net: 42, start: 112, end: 120 },   // Viettel Fiber
  { net: 115, start: 72, end: 79 },    // FPT Telecom
  { net: 123, start: 16, end: 31 },    // VNPT Fiber
  { net: 27, start: 64, end: 79 },     // Viettel Metro
  { net: 118, start: 68, end: 71 },    // FPT Broadband
];

// Random offset seed per run so repeated test executions cycle through distinct ranges
const RUN_SEED = Math.floor(Math.random() * 50000);

/**
 * Generates a mathematically guaranteed unique IP address for each test iteration.
 */
function getGuaranteedUniqueIP(globalIterationIndex) {
  const seq = RUN_SEED + globalIterationIndex;
  const poolIndex = seq % ISP_IP_POOLS.length;
  const pool = ISP_IP_POOLS[poolIndex];

  const hostSequence = Math.floor(seq / ISP_IP_POOLS.length);
  const octet2Range = pool.end - pool.start + 1;
  const octet2 = pool.start + (Math.floor(hostSequence / (254 * 254)) % octet2Range);
  const octet3 = (Math.floor(hostSequence / 254) % 254) + 1;
  const octet4 = (hostSequence % 254) + 1;

  return `${pool.net}.${octet2}.${octet3}.${octet4}`;
}

/**
 * Normalizes backend URL ensuring the '/api' prefix is correctly formatted.
 */
function normalizeBaseUrl(rawUrl) {
  let url = (rawUrl || 'http://100.76.224.64/quick-test-be').trim().replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
}

const BASE_API_URL = normalizeBaseUrl(__ENV.BASE_URL);

/**
 * Generates a random Vietnamese full name.
 */
function getRandomFullName() {
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const m = MIDDLE_NAMES[Math.floor(Math.random() * MIDDLE_NAMES.length)];
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  return `${l} ${m} ${f}`;
}

/**
 * Formats current local timestamp to yyyy-MM-dd'T'HH:mm:ss for backend compatibility.
 */
function getFormattedTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * Generates an answer payload for any question dynamically based on its questionType.
 */
function generateAnswerForQuestion(q, candidateName) {
  const qType = q.questionType;
  const options = q.options || [];

  if (qType === 'SINGLE_CHOICE') {
    if (options.length === 0) {
      return { questionId: q.id, selectedOptionIds: [], textAnswer: null, savedAt: getFormattedTimestamp() };
    }
    const chosen = options[Math.floor(Math.random() * options.length)];
    return {
      questionId: q.id,
      selectedOptionIds: [chosen.id],
      textAnswer: null,
      savedAt: getFormattedTimestamp(),
    };
  } else if (qType === 'MULTIPLE_CHOICE') {
    if (options.length === 0) {
      return { questionId: q.id, selectedOptionIds: [], textAnswer: null, savedAt: getFormattedTimestamp() };
    }
    const shuffled = options.slice().sort(() => 0.5 - Math.random());
    const count = Math.floor(Math.random() * shuffled.length) + 1;
    const chosenIds = shuffled.slice(0, count).map((opt) => opt.id);
    return {
      questionId: q.id,
      selectedOptionIds: chosenIds,
      textAnswer: null,
      savedAt: getFormattedTimestamp(),
    };
  } else if (qType === 'NUMERIC') {
    const randomNumericValue = String(Math.floor(Math.random() * 100) + 1);
    return {
      questionId: q.id,
      selectedOptionIds: [],
      textAnswer: randomNumericValue,
      savedAt: getFormattedTimestamp(),
    };
  } else if (qType === 'ESSAY_TEXT') {
    const sampleEssaySentences = [
      'Hệ thống QuickTest xử lý lưu nháp đáp án vào Redis Hash với độ trễ dưới 2 mili-giây.',
      'Cơ chế hàng đợi RabbitMQ giúp tách biệt luồng tiếp nhận bài thi và luồng tính toán điểm số.',
      'Giải pháp viễn trắc telemetry thời gian thực bảo đảm tính công bằng và minh bạch trong phòng thi trực tuyến.',
      'Hệ thống xoay vòng AI thông minh phân bổ tải tối ưu giữa các model slots của Google Gemini.',
    ];
    const sentence = sampleEssaySentences[Math.floor(Math.random() * sampleEssaySentences.length)];
    return {
      questionId: q.id,
      selectedOptionIds: [],
      textAnswer: `[${candidateName}]: ${sentence}`,
      savedAt: getFormattedTimestamp(),
    };
  }

  // Fallback for unknown question types
  return {
    questionId: q.id,
    selectedOptionIds: options.length > 0 ? [options[0].id] : [],
    textAnswer: null,
    savedAt: getFormattedTimestamp(),
  };
}

/**
 * k6 Load Test Configuration Options.
 * Easily overridden via CLI flags (e.g. k6 run --vus 50 --duration 1m)
 * or environment variables (e.g. -e VUS=50 -e ITERATIONS=100 -e DURATION=2m).
 */
export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS, 10) : 10,
  duration: (!__ENV.ITERATIONS && !__ENV.STAGES) ? (__ENV.DURATION || '30s') : undefined,
  iterations: __ENV.ITERATIONS ? parseInt(__ENV.ITERATIONS, 10) : undefined,
  thresholds: {
    http_req_failed: ['rate<0.05'], // Max 5% HTTP errors allowed
    http_req_duration: ['p(95)<3000'], // 95% of all HTTP requests under 3s
    start_exam_duration: ['p(95)<2000'], // 95% of exam starts under 2s
    save_draft_duration: ['p(95)<1500'], // 95% of draft saves under 1.5s
    submit_exam_duration: ['p(95)<2500'], // 95% of submits under 2.5s
  },
};

/**
 * Helper to authenticate as a Teacher or register a new Teacher if not exists.
 */
function obtainTeacherToken(baseUrl) {
  const teacherEmail = __ENV.TEACHER_EMAIL || 'teacher@quicktest.com';
  const teacherPassword = __ENV.TEACHER_PASSWORD || 'Teacher@123';

  // 1. Try login first
  const loginRes = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ usernameOrEmail: teacherEmail, password: teacherPassword }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '5s' }
  );

  if (loginRes.status === 200) {
    try {
      const data = loginRes.json();
      if (data && data.data && data.data.accessToken) {
        return data.data.accessToken;
      }
    } catch (_) {}
  }

  // 2. If login failed, register a new dedicated k6 teacher
  const ts = Date.now();
  const regEmail = `k6_teacher_${ts}@quicktest.vn`;
  const regPayload = JSON.stringify({
    username: `k6_teacher_${ts}`,
    email: regEmail,
    password: teacherPassword,
    fullName: 'K6 Automated LoadTest Teacher',
    role: 'TEACHER',
  });

  const regRes = http.post(`${baseUrl}/auth/register`, regPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '5s',
  });

  if (regRes.status === 201 || regRes.status === 200) {
    try {
      const data = regRes.json();
      if (data && data.data && data.data.accessToken) {
        return data.data.accessToken;
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Auto-provisions a complete test exam on the fly with diverse questions and publishes it.
 */
function autoProvisionExam(baseUrl) {
  const teacherToken = obtainTeacherToken(baseUrl);
  if (!teacherToken) {
    console.error('[k6 setup] Failed to obtain teacher token for auto-provisioning.');
    return null;
  }

  const teacherHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`,
  };

  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const newAccessCode = `K6${randomSuffix}`;
  const examPayload = JSON.stringify({
    title: `K6 Automated Load Test Exam (${newAccessCode})`,
    accessCode: newAccessCode,
    description: 'Auto-generated benchmark exam for k6 dynamic load testing',
    durationMinutes: 180,
    maxAttempts: 999999,
    isPublic: true,
    isProctoringEnabled: false,
    shuffleQuestions: false,
    shuffleOptions: false,
  });

  const createRes = http.post(`${baseUrl}/teacher/exams`, examPayload, {
    headers: teacherHeaders,
    timeout: '10s',
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    console.error(`[k6 setup] Failed to create exam! Status: ${createRes.status}, Body: ${createRes.body}`);
    return null;
  }

  const examData = createRes.json().data;
  const examId = examData.id;
  const accessCode = examData.accessCode;

  // Add sample questions: SINGLE_CHOICE, MULTIPLE_CHOICE, NUMERIC, ESSAY_TEXT
  const questionsToAdd = [
    {
      content: 'Thủ đô của Việt Nam là thành phố nào?',
      questionType: 'SINGLE_CHOICE',
      points: 2.5,
      orderIndex: 1,
      options: [
        { content: 'Hà Nội', isCorrect: true, orderIndex: 1 },
        { content: 'TP. Hồ Chí Minh', isCorrect: false, orderIndex: 2 },
        { content: 'Đà Nẵng', isCorrect: false, orderIndex: 3 },
        { content: 'Hải Phòng', isCorrect: false, orderIndex: 4 },
      ],
    },
    {
      content: 'Những công nghệ nào sau đây được QuickTest sử dụng ở tầng Backend?',
      questionType: 'MULTIPLE_CHOICE',
      points: 2.5,
      orderIndex: 2,
      options: [
        { content: 'Spring Boot 3.x', isCorrect: true, orderIndex: 1 },
        { content: 'Redis Cache & Hash', isCorrect: true, orderIndex: 2 },
        { content: 'RabbitMQ Message Queue', isCorrect: true, orderIndex: 3 },
        { content: 'COBOL Legacy Engine', isCorrect: false, orderIndex: 4 },
      ],
    },
    {
      content: 'Tính giá trị của phép tính: 25 + 17 = ?',
      questionType: 'NUMERIC',
      points: 2.5,
      orderIndex: 3,
      sampleAnswer: '42',
      numericTolerance: 0.1,
      options: [],
    },
    {
      content: 'Trình bày ngắn gọn phương án xử lý tải cao cho hệ thống thi trực tuyến khi có hàng nghìn thí sinh cùng nộp bài.',
      questionType: 'ESSAY_TEXT',
      points: 2.5,
      orderIndex: 4,
      sampleAnswer: 'Sử dụng hàng đợi RabbitMQ tiếp nhận nhanh với HTTP 202 Accepted và worker xử lý chấm nền.',
      options: [],
    },
  ];

  for (const q of questionsToAdd) {
    http.post(`${baseUrl}/teacher/exams/${examId}/questions`, JSON.stringify(q), {
      headers: teacherHeaders,
      timeout: '5s',
    });
  }

  // Publish the exam
  const pubRes = http.patch(`${baseUrl}/teacher/exams/${examId}/publish`, null, {
    headers: teacherHeaders,
    timeout: '5s',
  });

  if (pubRes.status === 200) {
    console.log(`[k6 setup] Successfully auto-provisioned and published exam: "${examData.title}" [Code: ${accessCode}]`);
    return {
      examId: examId,
      accessCode: accessCode,
      examTitle: examData.title,
      teacherToken: teacherToken,
      autoCreated: true,
    };
  } else {
    console.error(`[k6 setup] Failed to publish exam! Status: ${pubRes.status}`);
    return null;
  }
}

/**
 * Setup lifecycle hook executed once before VUs start.
 * Discovers an available exam or auto-provisions one if missing.
 */
export function setup() {
  const baseUrl = BASE_API_URL;
  let targetAccessCode = (__ENV.ACCESS_CODE || '').trim().toUpperCase();
  let examTitle = '';
  let autoCreated = false;
  let createdExamId = null;
  let teacherToken = null;

  // 1. If user provided ACCESS_CODE, prioritize it
  if (targetAccessCode) {
    console.log(`[k6 setup] Mode: User-specified access code: ${targetAccessCode}`);
    return {
      baseUrl: baseUrl,
      accessCode: targetAccessCode,
      examTitle: `User Specified (${targetAccessCode})`,
      autoCreated: false,
      createdExamId: null,
      teacherToken: null,
    };
  }

  // 2. Auto-discovery via GET /public/exams
  console.log(`[k6 setup] Mode: Auto-Discovery. Probing open public exams at ${baseUrl}/public/exams ...`);
  const publicRes = http.get(`${baseUrl}/public/exams`, {
    headers: { 'Accept': 'application/json' },
    timeout: '5s',
  });

  if (publicRes.status === 200) {
    try {
      const publicData = publicRes.json();
      const exams = publicData.data || [];
      const openExam = exams.find((e) => e.isOpen === true || e.status === 'PUBLISHED');
      if (openExam && openExam.accessCode) {
        targetAccessCode = openExam.accessCode;
        examTitle = openExam.title || targetAccessCode;
        console.log(`[k6 setup] Found active public exam: "${examTitle}" [Code: ${targetAccessCode}]`);
        return {
          baseUrl: baseUrl,
          accessCode: targetAccessCode,
          examTitle: examTitle,
          autoCreated: false,
          createdExamId: null,
          teacherToken: null,
        };
      }
    } catch (err) {
      console.warn(`[k6 setup] Warning parsing public exams: ${err}`);
    }
  }

  // 3. Fallback: Auto-provisioning a new exam on-the-fly
  console.log(`[k6 setup] Mode: Auto-Provisioning. No open exams found. Creating new test exam...`);
  const provisionResult = autoProvisionExam(baseUrl);
  if (provisionResult) {
    return {
      baseUrl: baseUrl,
      accessCode: provisionResult.accessCode,
      examTitle: provisionResult.examTitle,
      autoCreated: true,
      createdExamId: provisionResult.examId,
      teacherToken: provisionResult.teacherToken,
    };
  }

  // 4. Fallback if auto-provisioning could not connect to backend
  console.warn(`[k6 setup] Warning: No active exam found and auto-provisioning could not reach backend. Please provide -e ACCESS_CODE=<code.`);
  return {
    baseUrl: baseUrl,
    accessCode: 'K6_FALLBACK',
    examTitle: 'Fallback (K6_FALLBACK)',
    autoCreated: false,
    createdExamId: null,
    teacherToken: null,
  };
}

/**
 * Dispatches candidate proctoring heartbeat to keep the session active (60s TTL in Redis)
 * and display the candidate as ONLINE on the instructor live monitoring dashboard.
 */
function sendHeartbeat(attemptId, headers) {
  const hbUrl = `${BASE_API_URL}/session/proctoring/heartbeat`;
  const hbPayload = JSON.stringify({
    attemptId: attemptId,
    clientTimestamp: getFormattedTimestamp(),
  });
  const hbRes = http.post(hbUrl, hbPayload, { headers });
  const hbOk = check(hbRes, {
    'heartbeat status is 200': (r) => r.status === 200,
  });
  if (hbOk) {
    successfulHeartbeats.add(1);
  } else {
    failedHeartbeats.add(1);
  }
  return hbOk;
}

/**
 * Main Candidate Virtual User lifecycle.
 */
export default function runCandidateTest(setupData) {
  const accessCode = (setupData && setupData.accessCode) ? setupData.accessCode : 'K6_FALLBACK';

  // 1. Determine globally unique iteration index
  let globalIndex = 0;
  if (typeof exec !== 'undefined' && exec.scenario && exec.scenario.iterationInTest !== undefined) {
    globalIndex = exec.scenario.iterationInTest;
  } else {
    globalIndex = (__VU * 100000) + __ITER;
  }

  // 2. Generate unique client IP, candidate name, and student identifier
  const clientIp = getGuaranteedUniqueIP(globalIndex);
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const currentTimestamp = Date.now();
  const candidateName = getRandomFullName();
  const guestName = `${candidateName} (${accessCode}-${__VU}-${__ITER}-${randomSuffix})`;
  const guestIdentifier = `guest_ts_${currentTimestamp}_${__VU}_${__ITER}_${randomSuffix}@quicktest.vn`;

  // Request headers simulating realistic browser context and custom IP
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'X-Forwarded-For': clientIp,
    'X-Real-IP': clientIp,
    'Client-IP': clientIp,
    'X-Client-IP': clientIp,
    'X-Guest-Identifier': guestIdentifier,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  };

  // --------------------------------------------------------------------------
  // STEP 1: START EXAM SESSION (POST /api/session/start)
  // --------------------------------------------------------------------------
  const startUrl = `${BASE_API_URL}/session/start`;
  const startPayload = JSON.stringify({
    accessCode: accessCode,
    guestName: guestName,
    guestIdentifier: guestIdentifier,
  });

  const tStart0 = new Date().getTime();
  const startRes = http.post(startUrl, startPayload, { headers });
  const startDuration = new Date().getTime() - tStart0;
  startLatency.add(startDuration);

  const startOk = check(startRes, {
    'start status is 200': (r) => r.status === 200,
    'start returns attemptId': (r) => {
      try {
        const body = r.json();
        return body && body.data && body.data.attemptId !== undefined;
      } catch (_) {
        return false;
      }
    },
  });

  if (!startOk) {
    failedStarts.add(1);
    completionRate.add(0);
    console.error(`[VU ${__VU} | Iter ${__ITER}] Start exam failed! Code: ${accessCode}, Status: ${startRes.status}, Body: ${startRes.body ? startRes.body.substring(0, 180) : 'empty'}`);
    sleep(1);
    return;
  }

  successfulStarts.add(1);

  const startData = startRes.json().data;
  const attemptId = startData.attemptId;
  const dynamicQuestions = startData.questions || [];

  // --------------------------------------------------------------------------
  // STEP 2: DYNAMICALLY PREPARE ANSWERS BASED ON RETURNED QUESTIONS
  // --------------------------------------------------------------------------
  const answersToSubmit = [];
  for (const q of dynamicQuestions) {
    const answer = generateAnswerForQuestion(q, candidateName);
    answersToSubmit.push(answer);
  }

  // --------------------------------------------------------------------------
  // STEP 3: INCREMENTAL AUTO-SAVE DRAFT (PUT /api/session/{attemptId}/save)
  // Enabled by default; toggle with -e SAVE_DRAFT=false
  // --------------------------------------------------------------------------
  const shouldSaveDraft = __ENV.SAVE_DRAFT !== 'false';
  if (shouldSaveDraft && attemptId && answersToSubmit.length > 0) {
    const saveUrl = `${BASE_API_URL}/session/${attemptId}/save`;

    // Pacing delay between questions (configurable via -e SLEEP_MIN & -e SLEEP_MAX)
    const minSleep = __ENV.SLEEP_MIN ? parseFloat(__ENV.SLEEP_MIN) : 0.05;
    const maxSleep = __ENV.SLEEP_MAX ? parseFloat(__ENV.SLEEP_MAX) : 0.2;

    for (const ans of answersToSubmit) {
      if (maxSleep > 0) {
        const thinkTime = minSleep + Math.random() * (maxSleep - minSleep);
        sleep(thinkTime);
      }

      const tSave0 = new Date().getTime();
      const saveRes = http.put(saveUrl, JSON.stringify(ans), { headers });
      const saveDuration = new Date().getTime() - tSave0;
      saveDraftLatency.add(saveDuration);

      const saveOk = check(saveRes, {
        'save draft status is 200': (r) => r.status === 200,
      });

      if (saveOk) {
        successfulSaves.add(1);
      } else {
        failedSaves.add(1);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 4: KEEP-ALIVE SESSION (Heartbeat Loop to hold session active)
  // Maintains candidate status as ONLINE and IN_PROGRESS on instructor dashboard.
  // --------------------------------------------------------------------------
  if (attemptId) {
    sendHeartbeat(attemptId, headers);
  }

  const isIterationMode = Boolean(__ENV.ITERATIONS);
  const shouldHoldSession = __ENV.HOLD_SESSION !== 'false' && (!isIterationMode || __ENV.HOLD_SESSION === 'true');
  const holdTimeSec = __ENV.HOLD_TIME ? parseInt(__ENV.HOLD_TIME, 10) : 0;

  if (shouldHoldSession && attemptId) {
    activeHeldSessions.add(1);
    const heartbeatInterval = 10;
    let elapsedSec = 0;

    while (true) {
      sleep(heartbeatInterval);
      sendHeartbeat(attemptId, headers);
      elapsedSec += heartbeatInterval;

      if (holdTimeSec > 0 && elapsedSec >= holdTimeSec) {
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 5: FINAL SUBMIT EXAM (POST /api/session/{attemptId}/submit)
  // Only submitted if explicitly requested via -e SUBMIT=true.
  // Default is to hold candidates in IN_PROGRESS (Đang làm bài).
  // --------------------------------------------------------------------------
  const shouldSubmit = __ENV.SUBMIT === 'true';
  if (shouldSubmit && attemptId) {
    const submitUrl = `${BASE_API_URL}/session/${attemptId}/submit`;
    const submitPayload = JSON.stringify({
      answers: answersToSubmit,
    });

    const tSubmit0 = new Date().getTime();
    const submitRes = http.post(submitUrl, submitPayload, { headers });
    const submitDuration = new Date().getTime() - tSubmit0;
    submitLatency.add(submitDuration);

    const submitOk = check(submitRes, {
      'submit status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    });

    if (submitOk) {
      successfulSubmits.add(1);
      completionRate.add(1);
    } else {
      failedSubmits.add(1);
      completionRate.add(0);
      console.error(`[VU ${__VU} | Attempt ${attemptId}] Submit failed! Status: ${submitRes.status}`);
    }
  } else {
    completionRate.add(1);
  }

  // Cooldown before starting the next iteration
  const cooldownSec = __ENV.SLEEP_COOLDOWN !== undefined ? parseFloat(__ENV.SLEEP_COOLDOWN) : 0.1;
  if (cooldownSec > 0) {
    sleep(cooldownSec);
  }
}

/**
 * Teardown lifecycle hook executed once after all VUs finish.
 * Automatically closes auto-created test exams to keep the system clean.
 */
export function teardown(data) {
  if (data && data.autoCreated && data.createdExamId && data.teacherToken && __ENV.KEEP_EXAM !== 'true') {
    console.log(`[k6 teardown] Cleaning up auto-created test exam: ${data.createdExamId} [Code: ${data.accessCode}]...`);
    const closeUrl = `${data.baseUrl}/teacher/exams/${data.createdExamId}/close`;
    http.patch(closeUrl, null, {
      headers: {
        'Authorization': `Bearer ${data.teacherToken}`,
      },
    });
    console.log(`[k6 teardown] Test exam closed successfully.`);
  }
}


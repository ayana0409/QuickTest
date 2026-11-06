#!/usr/bin/env python3
"""
QuickTest Load & Stress Testing Script for Exam CMPL8N.
Simulates concurrent realistic student candidates:
1. Join room (POST /api/session/start)
2. Read questions & save answers incrementally to Redis Hash (PUT /api/session/{attemptId}/save)
3. Wait at a synchronization barrier
4. Spike submit all attempts simultaneously (POST /api/session/{attemptId}/submit)
5. Generate detailed latency (Min, Max, Avg, P50, P90, P95, P99), throughput, and error metrics.
"""

import sys
import os
import json
import time
import random
import uuid
import argparse
import statistics
from typing import List, Dict, Any, Optional

# Force UTF-8 stdout encoding on Windows to prevent charmap errors
if sys.platform == "win32":
    import io
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

# Auto-check and prompt for aiohttp installation if needed
try:
    import aiohttp
    import asyncio
except ImportError:
    print("\n[!] 'aiohttp' library is required for high-concurrency async load testing.")
    print("    Installing 'aiohttp' automatically via pip...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "aiohttp"])
    import aiohttp
    import asyncio

# Master Question Bank for Exam CMPL8N retrieved from PostgreSQL
EXAM_CODE = "CMPL8N"
QUESTIONS_BANK = [
    {
        "id": "be1caa1e-d3c4-4569-a7be-379809c09478",
        "type": "SINGLE_CHOICE",
        "order": 1,
        "content": "Theo tài liệu, mật mã học là gì?",
        "options": [
            {"id": "7dce7860-42c4-4aa2-a062-4be67906d00a", "is_correct": True},
            {"id": "8685be5f-c952-47ca-b071-ec3e4e30d900", "is_correct": False},
            {"id": "1894da99-dd27-4704-9f7d-745fed8bd928", "is_correct": False},
            {"id": "3f041b0f-ca70-426f-9e0b-084ea7dfeb71", "is_correct": False},
        ]
    },
    {
        "id": "ac8580bd-f792-4a12-8c2c-9f7a2ce81a20",
        "type": "MULTIPLE_CHOICE",
        "order": 2,
        "content": "Đâu là các vai trò chính của mật mã học được đề cập trong tài liệu?",
        "options": [
            {"id": "01b1a330-b884-41b4-9ac4-1b875111b745", "is_correct": True},
            {"id": "c58ad18b-1022-4293-a785-e22236c731a0", "is_correct": True},
            {"id": "b55dcad6-aea5-4009-a8d1-367ec3165776", "is_correct": True},
            {"id": "3da5d4bb-a091-4083-bb68-7f1bd17c4fc2", "is_correct": False},
        ]
    },
    {
        "id": "f9171a82-43d5-4ecf-9e6e-387180cbc6f6",
        "type": "SINGLE_CHOICE",
        "order": 3,
        "content": "Định nghĩa nào sau đây mô tả đúng về 'Bản rõ' (Plaintext)?",
        "options": [
            {"id": "e2904c9b-4085-4014-9912-6e6ad3f2154f", "is_correct": True},
            {"id": "33b0c07f-74bb-475e-9d23-877d1e161538", "is_correct": False},
            {"id": "b9d3722a-1786-4d07-9dfb-d6f712bc9067", "is_correct": False},
            {"id": "c3b42ada-dedb-42d9-a357-68417bec0475", "is_correct": False},
        ]
    },
    {
        "id": "21f0b9ae-4ca9-4f9b-8a21-fa513e09d15f",
        "type": "SINGLE_CHOICE",
        "order": 4,
        "content": "Quá trình biến đổi bản rõ thành bản mật được gọi là gì?",
        "options": [
            {"id": "0b7d304c-d141-417c-93af-e5dc10415dd9", "is_correct": True},
            {"id": "6fe620ee-77fe-459a-b58a-460fdfd8ee6d", "is_correct": False},
            {"id": "2da6788b-1254-4b4b-bedb-717bae59d954", "is_correct": False},
            {"id": "c653f147-148c-40b0-84e1-f43d5bb3956a", "is_correct": False},
        ]
    },
    {
        "id": "762e905e-85d1-47e8-a186-d8c114397676",
        "type": "SINGLE_CHOICE",
        "order": 5,
        "content": "Khái niệm 'Phá mã' được định nghĩa như thế nào trong tài liệu?",
        "options": [
            {"id": "8f8f157e-e866-422c-901d-e87f07a60ed9", "is_correct": True},
            {"id": "df586d3f-3040-4d62-b579-bf5fec64b3a7", "is_correct": False},
            {"id": "27d048cb-fbd6-4071-b6e2-c0ca5a5be740", "is_correct": False},
            {"id": "bea261a2-96e5-410e-9e89-da1f254beb09", "is_correct": False},
        ]
    },
    {
        "id": "ce11acac-6f9c-493b-8446-717a830701f5",
        "type": "MULTIPLE_CHOICE",
        "order": 6,
        "content": "Tất cả các giải thuật mã hóa đều dựa trên 2 nguyên lý nào khi biến đổi bản rõ thành bản mật?",
        "options": [
            {"id": "3613613f-eafd-4558-ad39-b40181f8a4f0", "is_correct": True},
            {"id": "8ea0f2e8-33e7-424b-9611-80e9506f9efa", "is_correct": True},
            {"id": "2970decd-3759-4da9-b8a5-deaad7d76b23", "is_correct": False},
            {"id": "43f5b29b-48bc-450d-a135-8fdc30963223", "is_correct": False},
        ]
    },
    {
        "id": "563f8804-8506-491e-853f-568a9d075c6e",
        "type": "MULTIPLE_CHOICE",
        "order": 7,
        "content": "Theo cách thức bản rõ được xử lý, các hệ mã được chia thành những loại nào?",
        "options": [
            {"id": "2387bc0f-125b-484e-9fb5-227a3aea899d", "is_correct": True},
            {"id": "f15bf5ab-cf2a-4799-879b-d095a48b68ae", "is_correct": True},
            {"id": "dff9ef30-7aa1-4990-a144-6613a2a943c9", "is_correct": False},
            {"id": "5a07307c-601d-49ac-a594-5c8e2e77fc46", "is_correct": False},
        ]
    },
    {
        "id": "1076a280-a03d-4805-a885-c47b1541b4cc",
        "type": "SINGLE_CHOICE",
        "order": 8,
        "content": "Mật mã Ceasar (dịch vòng) thuộc loại mật mã nào?",
        "options": [
            {"id": "4732b768-33f6-4535-9a81-98efdb7112f0", "is_correct": True},
            {"id": "b0b8a88e-d72d-4b80-a0b6-f627fa35fa9e", "is_correct": False},
            {"id": "74aa21d1-4978-488c-a946-c679f4d8c4c8", "is_correct": False},
            {"id": "78f06dca-624b-422b-8ea7-fa7e1571d7a7", "is_correct": False},
        ]
    },
    {
        "id": "0807c00e-9dcb-49e4-a14c-3e959239d23b",
        "type": "SINGLE_CHOICE",
        "order": 9,
        "content": "Trong mật mã học, quá trình nào được định nghĩa là việc khôi phục dữ liệu gốc từ bản mã một cách hợp pháp khi biết khóa giải mã?",
        "options": [
            {"id": "5dd30a5c-8e64-444d-b545-547a7d479aa9", "is_correct": False},
            {"id": "219a2263-b0b8-40fe-b5c9-01584f665954", "is_correct": True},
            {"id": "d8f93e33-5a1b-476d-8bfa-55007346cde2", "is_correct": False},
            {"id": "30d862d7-f036-4d0a-a663-81dc4460a533", "is_correct": False},
        ]
    },
    {
        "id": "fcfa374c-aa80-41de-8778-ed3a8ed6b81b",
        "type": "MULTIPLE_CHOICE",
        "order": 10,
        "content": "Theo tài liệu, những thành phần nào sau đây có thể được sử dụng để tạo nên bản rõ (Plaintext)?",
        "options": [
            {"id": "a714756e-7f68-4003-ad79-a0fa2973207c", "is_correct": True},
            {"id": "e21b6a37-1a6c-4186-bdbf-afd157aa1ebc", "is_correct": True},
            {"id": "0bf400b8-6454-48a2-82e1-136483680f75", "is_correct": True},
            {"id": "929ae5e7-7c47-494b-ab0b-49ac0c922a9f", "is_correct": False},
        ]
    },
    {
        "id": "6eb90d42-6812-43a4-9dab-0ef605c2332f",
        "type": "SINGLE_CHOICE",
        "order": 11,
        "content": "Trong các hệ mật mã, thuật ngữ nào dùng để chỉ nghệ thuật phá các hệ mật mã?",
        "options": [
            {"id": "134d4cf3-692f-4f97-a371-df854d77a346", "is_correct": False},
            {"id": "d9db5f49-c8f3-4d36-9cd8-1550f5061c34", "is_correct": False},
            {"id": "5d339a16-a6ff-4d81-a503-1d596e4ef909", "is_correct": True},
            {"id": "35443fcb-79b0-4de0-94cd-6703043b96e4", "is_correct": False},
        ]
    },
    {
        "id": "c14833ca-a583-4b3b-9f9e-e8c2adfde2cf",
        "type": "SINGLE_CHOICE",
        "order": 12,
        "content": "Hệ mã hóa nào xử lý từng khối dữ liệu tại một thời điểm và sản sinh một khối dữ liệu ở đầu ra?",
        "options": [
            {"id": "c6062562-6237-4c39-aee1-0700f891ce52", "is_correct": False},
            {"id": "abe46549-f8a2-4299-87b6-c8a01aa8c288", "is_correct": True},
            {"id": "787a9d6a-b354-4458-9c44-865b48e698cd", "is_correct": False},
            {"id": "01af1d2f-caf5-4877-9bcf-e77b2cfcad4b", "is_correct": False},
        ]
    },
    {
        "id": "e85825a4-d01a-4618-bf17-58a9f9d136a9",
        "type": "MULTIPLE_CHOICE",
        "order": 13,
        "content": "Theo tài liệu, các hệ mật mã hóa được mô tả bởi những đặc tính nào sau đây?",
        "options": [
            {"id": "e835ca8f-2e74-46ce-9204-cf272064e218", "is_correct": True},
            {"id": "c310d1f2-6a74-4f2a-8fcc-78fbf95fa80b", "is_correct": True},
            {"id": "60e0fb50-991a-4ff0-98b2-6341b9598dfe", "is_correct": True},
            {"id": "47bb5d3f-8352-40ab-b945-6fad6a7da8d2", "is_correct": False},
        ]
    },
    {
        "id": "51a617d1-18cc-478c-ae71-e9e7b1930e6e",
        "type": "SINGLE_CHOICE",
        "order": 14,
        "content": "Trong mật mã Playfair, nếu hai ký tự của bản rõ nằm cùng một dòng trong ma trận khóa, chúng sẽ được thay thế bằng gì?",
        "options": [
            {"id": "a3615189-bf5c-4cb9-9a27-f636e2d11fdc", "is_correct": False},
            {"id": "ef893996-d9d1-4dc1-bf97-a2b4b76fa672", "is_correct": True},
            {"id": "2af32f5d-9454-42c9-adab-e74d8ec113b5", "is_correct": False},
            {"id": "4683ac2c-c01b-47e5-99a9-6ec83101e64f", "is_correct": False},
        ]
    },
    {
        "id": "602aa98c-497d-4c56-8bda-06f0700ecb3e",
        "type": "SINGLE_CHOICE",
        "order": 15,
        "content": "Trong mật mã Playfair, hai chữ cái nào được xem như là một ký tự duy nhất trong ma trận khóa?",
        "options": [
            {"id": "ec513957-cdb5-4aa4-bc5a-cdf570cd975d", "is_correct": False},
            {"id": "fab75677-7bbe-4424-8cb6-a1e6ea49ba67", "is_correct": False},
            {"id": "bc245827-bcbc-4b65-9c72-755f808ddd59", "is_correct": True},
            {"id": "7a174e22-6df5-4332-a24a-9e555474dfcf", "is_correct": False},
        ]
    },
    {
        "id": "ed10f845-c99b-4fc3-a51d-aa06433b1ad1",
        "type": "SINGLE_CHOICE",
        "order": 16,
        "content": "Mật mã Hill thực hiện việc thay thế dựa trên phương trình nào?",
        "options": [
            {"id": "b11229e2-f361-4e5a-a644-73c0c0e928ba", "is_correct": False},
            {"id": "763baf37-6108-46ee-b3cd-e67f14b5b36e", "is_correct": True},
            {"id": "90aeb0e6-6205-410d-ab91-3c48f6cd138b", "is_correct": False},
            {"id": "32a9e4fa-106d-4a68-8a2f-2fa325b6e197", "is_correct": False},
        ]
    },
    {
        "id": "b7787fa0-0e95-4ec5-a3b7-97fc88b99caa",
        "type": "MULTIPLE_CHOICE",
        "order": 17,
        "content": "Khi áp dụng tấn công vét cạn (bruteforce) cho mật mã Ceasar, tại sao việc này lại khả thi?",
        "options": [
            {"id": "ba85bf15-9e3d-41c5-a4a6-c297a366b1c4", "is_correct": True},
            {"id": "e31b42bf-3dfe-41ba-bb98-7d821ddc0f60", "is_correct": True},
            {"id": "f28ec123-d352-4bba-9a87-83599bac558d", "is_correct": True},
            {"id": "1ca54854-a808-48e0-a05f-6f33e0e48a6d", "is_correct": False},
        ]
    },
    {
        "id": "7c62a7b0-07ea-4041-bbb7-c0b5abac458c",
        "type": "SINGLE_CHOICE",
        "order": 18,
        "content": "Trong mật mã Playfair, nếu bản rõ có 2 ký tự liên tiếp giống nhau, ta cần làm gì trước khi mã hóa?",
        "options": [
            {"id": "c772cb76-498e-4bea-bcdf-c45f966d9ae7", "is_correct": False},
            {"id": "a5b7e430-9599-4961-a84f-28e721e4035e", "is_correct": True},
            {"id": "bd417bde-b0c9-4423-bd39-20ab2e2a6d36", "is_correct": False},
            {"id": "1a50c6a0-701a-47cd-8f89-69ba10c771ee", "is_correct": False},
        ]
    },
    {
        "id": "d07df9bc-bbf5-4254-affd-25b2a4f97b23",
        "type": "SINGLE_CHOICE",
        "order": 19,
        "content": "Trong mật mã Hill, việc giải mã được thực hiện bằng cách nào?",
        "options": [
            {"id": "21b54b4e-7bf3-4c5a-8881-6dddc9cda5da", "is_correct": False},
            {"id": "c22da1df-e578-4966-94ab-1afce18284e7", "is_correct": True},
            {"id": "a507e1e1-3fa8-477a-98ec-cbd57044fa22", "is_correct": False},
            {"id": "2fc7b02a-d58c-4b9e-be02-bfbdaad986b3", "is_correct": False},
        ]
    },
    {
        "id": "a95f6dd4-44e2-48ac-a4fb-92114ffc8996",
        "type": "MULTIPLE_CHOICE",
        "order": 20,
        "content": "Theo tài liệu, các vai trò chính của mật mã học bao gồm những gì?",
        "options": [
            {"id": "4df60fd9-92f5-4edc-806d-96059db765d7", "is_correct": True},
            {"id": "9571d0dc-2979-471d-9b72-7ffee7a09dd2", "is_correct": True},
            {"id": "19f29164-dfcd-4f8f-a97f-82b5d1af2cff", "is_correct": True},
            {"id": "d1c88d71-40ee-4d0d-9dec-6880bd28d0e7", "is_correct": False},
        ]
    }
]


def generate_random_ip() -> str:
    """Generates a realistic distinct public IP address from Vietnam residential ISP pools."""
    prefixes = [
        (14, random.randint(160, 240)),
        (113, random.randint(160, 190)),
        (171, random.randint(224, 255)),
        (42, random.randint(112, 120)),
        (115, random.randint(72, 79)),
        (123, random.randint(16, 31)),
        (27, random.randint(64, 79)),
        (118, random.randint(68, 71)),
    ]
    p1, p2 = random.choice(prefixes)
    p3 = random.randint(1, 254)
    p4 = random.randint(1, 254)
    return f"{p1}.{p2}.{p3}.{p4}"


class CandidateSession:
    """Represents a single simulated student candidate with a unique IP address."""
    def __init__(self, index: int, accuracy_rate: float):
        self.index = index
        self.accuracy_rate = accuracy_rate
        self.guest_name = f"Thí sinh tải #{index:04d}_{uuid.uuid4().hex[:6]}"
        self.guest_id = f"stress_student_{index}_{uuid.uuid4().hex[:6]}@quicktest.test"
        self.client_ip = generate_random_ip()
        self.attempt_id: Optional[str] = None
        self.answers_to_submit: List[Dict[str, Any]] = []

    def get_headers(self) -> Dict[str, str]:
        """Provides headers simulating distinct client IP and legitimate browser headers to bypass reverse-proxy WAF and rate limiters."""
        return {
            "Content-Type": "application/json",
            "X-Forwarded-For": self.client_ip,
            "X-Real-IP": self.client_ip,
            "Client-IP": self.client_ip,
            "X-Client-IP": self.client_ip,
            "Proxy-Client-IP": self.client_ip,
            "WL-Proxy-Client-IP": self.client_ip,
            "HTTP_X_FORWARDED_FOR": self.client_ip,
            "HTTP_CLIENT_IP": self.client_ip,
            "X-Originating-IP": self.client_ip,
            "X-Guest-Identifier": self.guest_id,
            "Origin": "https://quicktest-kappa.vercel.app",
            "Referer": "https://quicktest-kappa.vercel.app/",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        }


def pick_answer_for_question(question: Dict[str, Any], accuracy_rate: float) -> List[str]:
    """
    Selects option IDs for a question based on candidate accuracy rate.
    If random roll <= accuracy_rate, candidate picks the correct answer(s).
    Otherwise, picks a random wrong or partial option.
    """
    q_type = question["type"]
    options = question["options"]
    correct_options = [opt["id"] for opt in options if opt.get("is_correct")]
    wrong_options = [opt["id"] for opt in options if not opt.get("is_correct")]

    is_pick_correct = random.random() <= accuracy_rate

    if q_type == "SINGLE_CHOICE":
        if is_pick_correct and correct_options:
            return [correct_options[0]]
        elif wrong_options:
            return [random.choice(wrong_options)]
        else:
            return [options[0]["id"]]
    else:  # MULTIPLE_CHOICE
        if is_pick_correct and correct_options:
            return correct_options
        else:
            # Pick a random subset of 1 to 3 options
            k = random.randint(1, min(3, len(options)))
            sample = random.sample([opt["id"] for opt in options], k)
            return sample


async def run_candidate_lifecycle(
    session: aiohttp.ClientSession,
    candidate: CandidateSession,
    base_url: str,
    access_code: str,
    barrier: asyncio.Barrier,
    read_delay_min: float,
    read_delay_max: float,
    save_draft: bool,
    save_count: int,
    send_heartbeat: bool,
    keep_alive_sec: int,
    do_submit: bool,
    metrics: Dict[str, Any],
    verbose: bool
):
    """
    Candidate lifecycle:
    1. Start Exam (POST /api/session/start) -> Sets status to IN_PROGRESS (Đang làm bài)
    2. Answer Questions & Save Draft (PUT /api/session/{attemptId}/save)
    3. Send proctoring heartbeat (POST /api/session/proctoring/heartbeat) to stay online
    4. Keep-alive loop (optional)
    5. Submit exam only if do_submit=True. By default do_submit=False to guarantee candidate stays IN_PROGRESS.
    """
    headers = candidate.get_headers()

    # ---------------- 1. Start Exam (Status becomes IN_PROGRESS) ----------------
    start_url = f"{base_url}/session/start"
    start_payload = {
        "accessCode": access_code,
        "guestName": candidate.guest_name,
        "guestIdentifier": candidate.guest_id
    }

    t0 = time.perf_counter()
    try:
        async with session.post(start_url, json=start_payload, headers=headers) as resp:
            latency_ms = (time.perf_counter() - t0) * 1000
            metrics["start_latencies"].append(latency_ms)
            if resp.status in (200, 201):
                data = await resp.json()
                candidate.attempt_id = data.get("data", {}).get("attemptId")
                metrics["start_success"] += 1
                metrics["in_progress_count"] += 1
                if verbose and candidate.index <= 5:
                    print(f"[{candidate.guest_name} | IP: {candidate.client_ip}] Joined session (IN_PROGRESS): attemptId={candidate.attempt_id}")
            else:
                metrics["start_fail"] += 1
                err_text = await resp.text()
                metrics["errors"].append(f"Start failed ({resp.status}): {err_text[:120]}")
                if do_submit:
                    await barrier.wait()
                return
    except Exception as e:
        metrics["start_fail"] += 1
        metrics["errors"].append(f"Start exception: {str(e)}")
        if do_submit:
            await barrier.wait()
        return

    # ---------------- 2. Answer Questions & Save Draft ----------------
    # Prepare answers for all 20 questions
    for q in QUESTIONS_BANK:
        selected = pick_answer_for_question(q, candidate.accuracy_rate)
        candidate.answers_to_submit.append({
            "questionId": q["id"],
            "selectedOptionIds": selected,
            "textAnswer": None,
            "savedAt": time.strftime("%Y-%m-%dT%H:%M:%S")
        })

    # Incrementally simulate thinking and saving draft to Redis Hash
    if save_draft and candidate.attempt_id and save_count != 0:
        save_url = f"{base_url}/session/{candidate.attempt_id}/save"
        answers_to_save = candidate.answers_to_submit
        if save_count > 0 and save_count < len(candidate.answers_to_submit):
            answers_to_save = candidate.answers_to_submit[:save_count]

        # Candidate saves answers for each question with realistic pacing
        for ans in answers_to_save:
            # Simulate student reading/thinking
            thinking_time = random.uniform(read_delay_min, read_delay_max)
            if thinking_time > 0:
                await asyncio.sleep(thinking_time)

            save_t0 = time.perf_counter()
            try:
                async with session.put(save_url, json=ans, headers=headers) as s_resp:
                    s_latency = (time.perf_counter() - save_t0) * 1000
                    metrics["save_latencies"].append(s_latency)
                    if s_resp.status in (200, 204):
                        metrics["save_success"] += 1
                    else:
                        metrics["save_fail"] += 1
            except Exception:
                metrics["save_fail"] += 1

    # ---------------- 3. Send Proctoring Heartbeat (Online Indicator) ----------------
    if send_heartbeat and candidate.attempt_id:
        hb_url = f"{base_url}/session/proctoring/heartbeat"
        hb_payload = {
            "attemptId": candidate.attempt_id,
            "clientTimestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        }
        try:
            async with session.post(hb_url, json=hb_payload, headers=headers) as hb_resp:
                if hb_resp.status in (200, 201):
                    metrics["heartbeat_success"] += 1
                else:
                    metrics["heartbeat_fail"] += 1
        except Exception:
            metrics["heartbeat_fail"] += 1

    # ---------------- 4. Optional Keep-Alive (Continuous Proctoring) ----------------
    if keep_alive_sec > 0 and candidate.attempt_id:
        elapsed = 0
        hb_url = f"{base_url}/session/proctoring/heartbeat"
        while elapsed < keep_alive_sec:
            await asyncio.sleep(min(5, keep_alive_sec - elapsed))
            elapsed += 5
            try:
                hb_payload = {
                    "attemptId": candidate.attempt_id,
                    "clientTimestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
                }
                async with session.post(hb_url, json=hb_payload, headers=headers) as hb_resp:
                    if hb_resp.status in (200, 201):
                        metrics["heartbeat_success"] += 1
            except Exception:
                pass

    # ---------------- 5. Submit Exam (Disabled by default to ensure IN_PROGRESS status) ----------------
    if not do_submit:
        # Candidate intentionally stays in 'IN_PROGRESS' (Đang làm bài) status
        return

    # Wait at barrier for synchronized submit
    metrics["ready_at_barrier"] += 1
    if verbose and metrics["ready_at_barrier"] % 25 == 0:
        print(f"[*] {metrics['ready_at_barrier']} candidates reached submit barrier. Waiting for all to align...")

    try:
        await barrier.wait()
    except asyncio.BrokenBarrierError:
        pass

    if candidate.attempt_id:
        submit_url = f"{base_url}/session/{candidate.attempt_id}/submit"
        submit_payload = {"answers": candidate.answers_to_submit}

        sub_t0 = time.perf_counter()
        try:
            async with session.post(submit_url, json=submit_payload, headers=headers) as sub_resp:
                sub_latency = (time.perf_counter() - sub_t0) * 1000
                metrics["submit_latencies"].append(sub_latency)

                if sub_resp.status in (200, 202):  # HTTP 202 Accepted or 200 OK
                    metrics["submit_success"] += 1
                    metrics["in_progress_count"] -= 1
                else:
                    metrics["submit_fail"] += 1
                    err_msg = await sub_resp.text()
                    metrics["errors"].append(f"Submit error ({sub_resp.status}): {err_msg[:120]}")
        except Exception as e:
            metrics["submit_fail"] += 1
            metrics["errors"].append(f"Submit network exception: {str(e)}")


def calculate_percentiles(latencies: List[float]) -> Dict[str, float]:
    """Calculates min, max, avg, and standard percentiles."""
    if not latencies:
        return {"min": 0, "max": 0, "avg": 0, "p50": 0, "p90": 0, "p95": 0, "p99": 0}
    sorted_lats = sorted(latencies)
    n = len(sorted_lats)
    return {
        "min": sorted_lats[0],
        "max": sorted_lats[-1],
        "avg": statistics.mean(sorted_lats),
        "p50": sorted_lats[int(n * 0.50)],
        "p90": sorted_lats[min(int(n * 0.90), n - 1)],
        "p95": sorted_lats[min(int(n * 0.95), n - 1)],
        "p99": sorted_lats[min(int(n * 0.99), n - 1)],
    }


def normalize_api_url(raw_url: str) -> str:
    """Ensures URL has scheme and ends with /api."""
    url = raw_url.strip().rstrip("/")
    if not url.startswith("http://") and not url.startswith("https://"):
        # Check if local IP or localhost
        host_part = url.split("/")[0].split(":")[0]
        is_ip_or_local = any(c.isdigit() for c in host_part.replace(".", "")) or host_part in ("localhost", "127.0.0.1")
        if is_ip_or_local:
            url = "http://" + url
        else:
            url = "https://" + url
    if not url.endswith("/api"):
        url = url + "/api"
    return url


async def main_load_test(args):
    target_url = normalize_api_url(args.url)

    print("=" * 80)
    print(f"[*] QUICKTEST CONCURRENT LOAD TEST FOR EXAM [{args.code}]")
    print("=" * 80)
    print(f"Target Server URL    : {target_url}")
    print(f"Concurrent Users     : {args.users} candidates (each with distinct spoofed IP)")
    print(f"Candidate Status     : {'ĐANG LÀM BÀI (IN_PROGRESS) [Nộp bài: TẮT]' if not args.submit else 'NỘP BÀI ĐỒNG THỜI (Submit Spike)'}")
    print(f"Answering Mode       : {'Realistic (Think + Save to Redis)' if args.save_draft else 'Quick Start'}")
    print(f"Think Delay / Q      : {args.min_delay}s - {args.max_delay}s")
    print(f"Answer Accuracy Rate : {int(args.accuracy * 100)}% correct")
    print(f"Total Exam Questions : {len(QUESTIONS_BANK)} questions")
    if args.keep_alive > 0:
        print(f"Keep-Alive Duration  : {args.keep_alive}s (sending heartbeat every 5s)")
    print("=" * 80)

    # Initialize Metrics Store
    metrics = {
        "start_success": 0,
        "start_fail": 0,
        "start_latencies": [],
        "in_progress_count": 0,
        "save_success": 0,
        "save_fail": 0,
        "save_latencies": [],
        "heartbeat_success": 0,
        "heartbeat_fail": 0,
        "ready_at_barrier": 0,
        "submit_success": 0,
        "submit_fail": 0,
        "submit_latencies": [],
        "errors": []
    }

    candidates = [CandidateSession(i + 1, args.accuracy) for i in range(args.users)]
    barrier = asyncio.Barrier(args.users)

    # SSL Context avoiding handshake rejections under high concurrency
    import ssl
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    # TCP Connector with high connection limit to avoid client-side bottleneck
    connector = aiohttp.TCPConnector(
        limit=max(args.users * 2, 200),
        limit_per_host=max(args.users * 2, 200),
        ttl_dns_cache=300,
        ssl=ssl_context
    )
    timeout = aiohttp.ClientTimeout(total=max(120, args.keep_alive + 60))

    overall_start_time = time.perf_counter()

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        tasks = [
            run_candidate_lifecycle(
                session=session,
                candidate=c,
                base_url=target_url,
                access_code=args.code,
                barrier=barrier,
                read_delay_min=args.min_delay,
                read_delay_max=args.max_delay,
                save_draft=args.save_draft,
                save_count=args.save_count,
                send_heartbeat=args.heartbeat,
                keep_alive_sec=args.keep_alive,
                do_submit=args.submit,
                metrics=metrics,
                verbose=args.verbose
            )
            for c in candidates
        ]

        print(f"\n[+] Launching {args.users} simulated candidates...")
        await asyncio.gather(*tasks)

    overall_duration = time.perf_counter() - overall_start_time

    # Compute Statistics
    start_pct = calculate_percentiles(metrics["start_latencies"])
    save_pct = calculate_percentiles(metrics["save_latencies"])
    submit_pct = calculate_percentiles(metrics["submit_latencies"])

    print("\n" + "=" * 80)
    print("[RESULTS] LOAD TEST SUMMARY")
    print("=" * 80)
    print(f"Total Execution Time : {overall_duration:.2f} seconds")
    print(f"Concurrent Users     : {args.users}")
    print(f"Candidate State      : {'ĐANG LÀM BÀI (IN_PROGRESS)' if not args.submit else 'ĐÃ NỘP BÀI (SUBMITTED)'}")
    print("-" * 80)

    print("1. [POST /api/session/start] Join Room:")
    print(f"   - Success Rate : {metrics['start_success']}/{args.users} ({metrics['start_success']/args.users*100:.1f}%)")
    print(f"   - Failures     : {metrics['start_fail']}")
    print(f"   - Latency (ms) : Min={start_pct['min']:.1f} | Avg={start_pct['avg']:.1f} | P50={start_pct['p50']:.1f} | P95={start_pct['p95']:.1f} | P99={start_pct['p99']:.1f} | Max={start_pct['max']:.1f}")

    if args.save_draft and args.save_count != 0:
        total_saves = metrics["save_success"] + metrics["save_fail"]
        print("-" * 80)
        print("2. [PUT /api/session/{attemptId}/save] Auto-save into Redis Hash:")
        print(f"   - Total Requests: {total_saves}")
        print(f"   - Success Rate  : {metrics['save_success']}/{total_saves} ({metrics['save_success']/max(total_saves, 1)*100:.1f}%)")
        print(f"   - Failures      : {metrics['save_fail']}")
        print(f"   - Latency (ms)  : Min={save_pct['min']:.1f} | Avg={save_pct['avg']:.1f} | P50={save_pct['p50']:.1f} | P95={save_pct['p95']:.1f} | P99={save_pct['p99']:.1f} | Max={save_pct['max']:.1f}")

    if args.heartbeat:
        total_hb = metrics["heartbeat_success"] + metrics["heartbeat_fail"]
        print("-" * 80)
        print("3. [POST /api/session/proctoring/heartbeat] Live Telemetry Heartbeat:")
        print(f"   - Active Online : {metrics['heartbeat_success']}/{total_hb} ({metrics['heartbeat_success']/max(total_hb, 1)*100:.1f}%)")

    print("-" * 80)
    if args.submit:
        print("4. [POST /api/session/{attemptId}/submit] SIMULTANEOUS SUBMIT SPIKE:")
        submit_total = metrics['submit_success'] + metrics['submit_fail']
        sub_pct_succ = (metrics['submit_success'] / max(submit_total, 1)) * 100
        print(f"   - Total Submits  : {submit_total}")
        print(f"   - HTTP 202 Queue : {metrics['submit_success']} ({sub_pct_succ:.1f}%)")
        print(f"   - Failures       : {metrics['submit_fail']}")
        print(f"   - Submit Spike Latency (ms):")
        print(f"       * Min Latency : {submit_pct['min']:.2f} ms")
        print(f"       * Avg Latency : {submit_pct['avg']:.2f} ms")
        print(f"       * P50 Median  : {submit_pct['p50']:.2f} ms")
        print(f"       * P90         : {submit_pct['p90']:.2f} ms")
        print(f"       * P95         : {submit_pct['p95']:.2f} ms")
        print(f"       * P99         : {submit_pct['p99']:.2f} ms")
        print(f"       * Max Latency : {submit_pct['max']:.2f} ms")
    else:
        print("4. [Trạng thái nộp bài]: ĐÃ TẮT (Thí sinh được giữ ở trạng thái Đang làm bài / IN_PROGRESS)")
        print(f"   - Số thí sinh Đang làm bài: {metrics['in_progress_count']}/{args.users} ({metrics['in_progress_count']/args.users*100:.1f}%)")

    if metrics["errors"]:
        print("-" * 80)
        print(f"[!] ERRORS DETECTED ({len(metrics['errors'])} occurrences):")
        unique_errors = list(dict.fromkeys(metrics["errors"]))[:5]
        for err in unique_errors:
            print(f"   - {err}")

    print("=" * 80)

    # Optional output file
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(f"# QuickTest Load Test Report - Exam {args.code}\n\n")
            f.write(f"- **Target URL**: {target_url}\n")
            f.write(f"- **Concurrent Candidates**: {args.users}\n")
            f.write(f"- **Candidate Status**: {'Đang làm bài (IN_PROGRESS)' if not args.submit else 'Đã nộp bài (SUBMITTED)'}\n")
            f.write(f"- **Active In-Progress**: {metrics['in_progress_count']}/{args.users}\n")
            f.write(f"- **Duration**: {overall_duration:.2f}s\n")
            f.write(f"- **Join Room Success**: {metrics['start_success']}/{args.users} ({metrics['start_success']/args.users*100:.1f}%)\n")
            f.write(f"- **Join Room Latency P95**: {start_pct['p95']:.2f} ms\n")
            if args.save_draft and args.save_count != 0:
                f.write(f"- **Draft Save Success**: {metrics['save_success']} saves\n")
                f.write(f"- **Draft Save Latency P95**: {save_pct['p95']:.2f} ms\n")
            if args.submit:
                f.write(f"- **Submit Success**: {metrics['submit_success']}/{submit_total} ({sub_pct_succ:.1f}%)\n")
                f.write(f"- **Submit Latency P95**: {submit_pct['p95']:.2f} ms\n")
                f.write(f"- **Submit Latency P99**: {submit_pct['p99']:.2f} ms\n")
            else:
                f.write("- **Submission**: Skipped (Thí sinh được giữ ở trạng thái đang làm bài)\n")
        print(f"[+] Saved report summary to: {args.output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QuickTest High-Concurrency Load Tester for Exam CMPL8N")
    parser.add_argument("--users", "-u", type=int, default=100, help="Number of concurrent candidates (e.g. 50, 100, 200, 500, 1000). Default: 100")
    parser.add_argument("--url", default="http://100.76.224.64/quick-test-be/api", help="Backend API base URL. Default: http://100.76.224.64/quick-test-be/api")
    parser.add_argument("--code", default=EXAM_CODE, help=f"Exam Room Access Code. Default: {EXAM_CODE}")
    parser.add_argument("--accuracy", "-a", type=float, default=0.8, help="Percentage of correct answers (0.0 to 1.0). Default: 0.8 (80%%)")
    parser.add_argument("--save-draft", action="store_true", default=True, help="Simulate incremental answering and draft saving to Redis. Default: True")
    parser.add_argument("--save-count", type=int, default=1, help="Number of questions to draft-save per student (0 to disable, 1-2 recommended to prevent proxy IP quota exhaustion, -1 for all 20). Default: 1")
    parser.add_argument("--pure-spike", dest="save_draft", action="store_false", help="Bypass answering delays, immediately start and spike-submit.")
    parser.add_argument("--submit", action="store_true", default=False, help="Submit exam at the end. Default: False (ensures candidates strictly remain 'IN_PROGRESS' / 'Đang làm bài').")
    parser.add_argument("--heartbeat", action="store_true", default=True, help="Send proctoring heartbeat to mark candidate as active/online in live monitor. Default: True")
    parser.add_argument("--keep-alive", type=int, default=0, help="Optional duration in seconds to keep sending heartbeats to stay online. Default: 0")
    parser.add_argument("--min-delay", type=float, default=0.05, help="Min seconds candidate pauses between questions. Default: 0.05s")
    parser.add_argument("--max-delay", type=float, default=0.2, help="Max seconds candidate pauses between questions. Default: 0.2s")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print progress logs for individual candidates.")
    parser.add_argument("--output", "-o", default="load_test_report.md", help="Path to write report markdown. Default: load_test_report.md")

    cli_args = parser.parse_args()

    # Run the event loop
    asyncio.run(main_load_test(cli_args))

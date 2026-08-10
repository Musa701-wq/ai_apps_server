# Backend API Integration Guide for Cursor AI

> This document contains all the information needed to update the Flutter frontend to use the hosted backend server instead of calling Google Gemini APIs directly.

---

## Overview

All AI API calls must be routed through our hosted backend server. The frontend should NEVER call Google Gemini APIs directly. All API keys are stored securely on the server.

**Backend Base URL:** `https://apps-model-server.mirdemy.com`

**Authentication:** Every request MUST include this header:
```
x-api-key: YOUR_STRIPE_SECRET_KEY
```

---

## All Available Endpoints

| Endpoint | Method | Model | Project | Use |
|---|---|---|---|---|
| `/api/gemini` | POST | gemini-2.5-flash | Student AI | General AI, chat, quiz, study plan |
| `/api/labmate/mri` | POST | gemini-2.0-flash | Labmate | MRI scan analysis |
| `/api/labmate/report` | POST | gemma-3-27b-it | Labmate | X-ray, ECG, Lab reports |
| `/api/plantai` | POST | gemini-2.5-flash-lite | Plant AI | Plant/pest identify, chat, watering plan |

---

## Request & Response Format

### Request Body
```json
{
  "prompt": "Your question or instruction here",
  "image_base64": "base64_encoded_string",
  "mime_type": "image/jpeg"
}
```
- `prompt` → always required
- `image_base64` + `mime_type` → only for image-based endpoints (optional)

### Success Response (200)
```json
{
  "result": "AI response text here"
}
```

### Error Responses
```json
{ "error": "Unauthorized: Invalid or missing API key" }  // 401
{ "error": "prompt field required hai" }                 // 400
{ "error": "..." }                                       // 500
```

---

## Project 1: Student AI

**Files to update:**
- Any file that calls Gemini API directly (chat, quiz, summarize, study plan)

**What to change:**
- Remove any direct Gemini API calls
- Replace with POST to `https://apps-model-server.mirdemy.com/api/gemini`
- Add `x-api-key` header

**Flutter implementation:**

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class GeminiService {
  static const String _baseUrl = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'YOUR_STRIPE_SECRET_KEY';

  Future<String> _ask(String prompt) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/gemini'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _accessKey,
      },
      body: jsonEncode({'prompt': prompt}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['result'] ?? 'No result';
    } else if (response.statusCode == 401) {
      throw Exception('Unauthorized');
    } else {
      throw Exception('Error: ${response.body}');
    }
  }

  Future<String> summarize(String text) async {
    return await _ask("Summarize the following text:\n\n$text");
  }

  Future<String> chat(String query) async {
    return await _ask(
      "You are a helpful Study Buddy AI. Answer only study-related questions. "
      "If unrelated, politely decline. Keep answers concise (max 3-4 lines). "
      "For problem-solving, only provide hints. User: $query"
    );
  }

  Future<String> chatWithContext(String query, List<Map<String, String>> context) async {
    final conversation = context.map((m) {
      final role = (m["role"] == "user") ? "user" : "model";
      return "$role: ${m["text"]}";
    }).join("\n");
    return await _ask("$conversation\nuser: $query");
  }

  Future<List<Map<String, dynamic>>> generateQuizFromNotes(String notes) async {
    final prompt = """
Generate exactly 5 multiple-choice quiz questions (MCQs) from the following notes:
$notes

Return STRICTLY as a JSON array, no explanations, no markdown.
Each object must look like this:
{
  "question": "string",
  "options": [
    {"text": "option A", "correct": false},
    {"text": "option B", "correct": true},
    {"text": "option C", "correct": false},
    {"text": "option D", "correct": false}
  ]
}
""";
    String result = await _ask(prompt);
    result = result.replaceAll("```json", "").replaceAll("```", "").trim();
    try {
      return List<Map<String, dynamic>>.from(jsonDecode(result));
    } catch (e) {
      return [];
    }
  }

  Future<String> generateStudyPlan({
    required String goal,
    required String examDate,
    required String startDate,
    required List<String> selectedNotes,
    required int studyDaysPerWeek,
    required int hoursPerDay,
  }) async {
    final prompt = """
You are a Study Planner AI. Create a detailed study plan:
- Goal: $goal
- Exam Date: $examDate
- Start Date: $startDate
- Study Days Per Week: $studyDaysPerWeek
- Study Hours Per Day: $hoursPerDay
- Notes: ${selectedNotes.join("\n")}

Return STRICTLY valid JSON only, no explanations. Structure:
{
  "goal": "", "examDate": "", "startDate": "",
  "studyDaysPerWeek": 0, "studyHoursPerDay": 0,
  "topics": [{"name": "", "description": "", "estimatedTime": 0, "assignedDays": []}],
  "studySchedule": [{"day": "", "topics": [], "hours": 0}],
  "reminders": []
}
""";
    return await _ask(prompt);
  }
}
```

---

## Project 2: Labmate

**Files to update:**
- MRI analysis service → use `/api/labmate/mri`
- X-ray / ECG / Lab report service → use `/api/labmate/report`

**What to change:**
- Remove direct Gemini/Gemma API calls
- Replace with POST to respective endpoints
- Add `x-api-key` header
- Send image as `image_base64` + `mime_type`

**Flutter implementation:**

```dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class LabmateService {
  static const String _baseUrl = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'YOUR_STRIPE_SECRET_KEY';

  // MRI Analysis
  static Future<String> analyzeMRI({
    required String prompt,
    File? imageFile,
  }) async {
    return await _call(
      endpoint: '/api/labmate/mri',
      prompt: prompt,
      imageFile: imageFile,
    );
  }

  // X-ray / ECG / Lab Report
  static Future<String> analyzeReport({
    required String prompt,
    File? imageFile,
  }) async {
    return await _call(
      endpoint: '/api/labmate/report',
      prompt: prompt,
      imageFile: imageFile,
    );
  }

  static Future<String> _call({
    required String endpoint,
    required String prompt,
    File? imageFile,
  }) async {
    final Map<String, dynamic> body = {'prompt': prompt};

    if (imageFile != null) {
      final bytes = await imageFile.readAsBytes();
      body['image_base64'] = base64Encode(bytes);
      body['mime_type'] = _getMimeType(imageFile.path);
    }

    final response = await http.post(
      Uri.parse('$_baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _accessKey,
      },
      body: jsonEncode(body),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['result'] ?? 'No result';
    } else if (response.statusCode == 401) {
      throw Exception('Unauthorized');
    } else {
      throw Exception('Error: ${response.body}');
    }
  }

  static String _getMimeType(String path) {
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
```

---

## Project 3: Plant AI

**Files to update:**
- `lib/modules/scan/gemini/services/gemini_api_service.dart` → image scan
- `lib/modules/ask_ai/services/chat_api_service.dart` → chat, details, watering plan

**What to change:**
- Remove direct `gemini-2.5-flash-lite` API calls
- Both files now call the same endpoint: `/api/plantai`
- Image calls include `image_base64` + `mime_type`
- Text calls send only `prompt`
- Add `x-api-key` header

**`gemini_api_service.dart` — replace with:**

```dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class GeminiApiService {
  static const String _baseUrl = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'YOUR_STRIPE_SECRET_KEY';

  static Future<String> identifyPlant({
    required String prompt,
    required File imageFile,
  }) async {
    final bytes = await imageFile.readAsBytes();

    final response = await http.post(
      Uri.parse('$_baseUrl/api/plantai'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _accessKey,
      },
      body: jsonEncode({
        'prompt': prompt,
        'image_base64': base64Encode(bytes),
        'mime_type': _getMimeType(imageFile.path),
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['result'] ?? 'No result';
    } else if (response.statusCode == 401) {
      throw Exception('Unauthorized');
    } else {
      throw Exception('Error: ${response.body}');
    }
  }

  static String _getMimeType(String path) {
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
```

**`chat_api_service.dart` — replace with:**

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class ChatApiService {
  static const String _baseUrl = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'YOUR_STRIPE_SECRET_KEY';

  static Future<String> chat(String prompt) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/plantai'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _accessKey,
      },
      body: jsonEncode({'prompt': prompt}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['result'] ?? 'No result';
    } else if (response.statusCode == 401) {
      throw Exception('Unauthorized');
    } else {
      throw Exception('Error: ${response.body}');
    }
  }
}
```

---

## Important Rules for Cursor

1. **NEVER** add `GEMINI_API_KEY` or any Google API key in Flutter code
2. **ALWAYS** include `x-api-key` header in every request
3. **ALWAYS** use `https://apps-model-server.mirdemy.com` as base URL
4. Images must be converted to **Base64** before sending
5. Response is always in `data['result']` field
6. Handle `401` as auth error, `400` as missing prompt, `500` as server error

# 펭귄 데이터로 배우는 기계학습 분류

`reference/기계학습과_데이터_분류(공유용).ipynb`와 `reference/penguins_size.csv`를 바탕으로 다시 구성한 한국어 웹 교재입니다.
실습 8개에 각각 2개 질문을 연결했습니다. 클로드·안티그래비티와 교차검토한 객관식 11개·단답 3개·서술형 2개이며, 학생은 미완성 코드를 직접 완성합니다.
자유 실험 셀을 추가해 같은 Python 환경에서 변수를 이어서 사용할 수 있습니다.
넓은 화면에서는 활동별 실습과 질문을 좌우로 함께 보고, 좁은 화면에서는 실습 아래로 질문이 이어집니다.

## 실행

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python scripts/build.py
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

http://localhost:8000 에서 데이터 소개부터 읽습니다. 코드는 01→08 순서로 빈칸을 채워 **실행·확인**하세요.
질문은 방금 실행한 출력/그래프를 근거로 답합니다. 서술형은 예시와 스스로 비교하며 자동 정오 판정은 하지 않습니다.
일반 개념 퀴즈와 예측·조건 변경 실험도 포함합니다. 여섯 질문의 **실험 코드 넣기**는 자유 셀로 코드를 복사하며 자동 실행하지 않습니다.
서술형은 문장 틀을 참고해 먼저 작성한 뒤 예시와 비교하고 체크리스트로 자기점검합니다.
Python 준비 중에도 설명과 질문은 읽고 답할 수 있습니다. 첫 실행은 Python·pandas·Matplotlib·seaborn·sklearn 다운로드가 필요합니다.
실제 CSV를 커널의 작업 폴더에 준비하므로 `pd.read_csv("penguins_size.csv")`로 읽습니다.

## 콘텐츠와 구현

- `TEACHING_PLAN.md`: 참고자료에서 유지·축약한 흐름과 질문 배치
- `scripts/course_penguins.py`: 설명·미션·질문·교사용 검증 답안의 공통 원본
- `scripts/quiz_questions.json`: 공동 검토 후 확정한 문항·실험 코드·자기점검 기준 원본
- `reviews/quiz-final-decisions.md`: 클로드·안티그래비티 제안의 수용·수정·기각 근거
- `scripts/create_notebook.py`: 웹 교재 데이터와 학생 노트북 생성
- `scripts/dataset_intro.py`: 원본 CSV를 변경 없이 복사하고 속성·미리보기 생성
- `scripts/exercise_checks.py`: 실행과 목표 달성을 구분하는 학습용 검사
- `content/01-penguins.ipynb`, `content/penguins_size.csv`: 학생용 파일
- `web/app.js`, `model.js`, `runtime.js`: 코드/질문 UI, 상태·노트북 저장, JupyterLite 공유 커널
- `web/textbook.css`: 안티그래비티의 교재 디자인
- `dist/`: AWS/HUSTOJ에 복사할 정적 빌드 결과

이전 Iris 데모는 `archive/demo-iris/`에 보존합니다. 현재 주 교재는 펭귄이며 서로 다른 단원의 파일을 잘못 불러오지 않게 구분합니다.
원자료와 제공 CSV는 `reference/`에 그대로 보존합니다.

## 저장과 제한

코드·실험 셀·질문 답·정리 글·출력은 현재 브라우저에 저장합니다. 변수는 새로고침/재시작하면 사라집니다.
**내 노트북 저장**은 코드와 일치하는 출력 및 모든 질문 답을 `.ipynb`로 내려받습니다.
**이전 노트북 불러오기**는 웹 저장 파일과 이 교재의 원본을 지원하며 자동 실행하지 않습니다.
Jupyter에서 파일을 추가 수정했다면 실제 코드 셀을 우선해 불러옵니다.
다른 PC로 옮길 때는 노트북과 CSV를 함께 보관하세요. 일반 Jupyter에서는 두 파일을 같은 폴더에 둡니다.

브라우저 출력은 텍스트·오류·PNG와 pandas DataFrame 표를 지원합니다.
`print(df)`는 텍스트, 셀 마지막 줄의 `df`나 `df.head()`는 노트북 형식의 표로 표시합니다.
DataFrame HTML에서 표의 구조와 텍스트만 복사하며 스크립트·이벤트·임의 HTML은 실행하지 않습니다.
모든 질문과 미션 검사는 학습 피드백이며 공식 성적/보안 채점이 아닙니다. HUSTOJ 로그인·제출·성적 저장은 아직 연결하지 않았습니다.

## 검증

```sh
.venv/bin/python scripts/validate_notebook.py
.venv/bin/python tests/check_exercises.py
node --test tests/textbook.test.mjs
```

학생 원본은 미완성 상태로 두고, 검증용 사본에 답안을 채워 전체 실행합니다. 산점도와 혼동행렬 PNG를 `artifacts/`에 저장합니다.
미션 검사는 올바른 답, 틀린 전처리·타깃·분할·혼동행렬, 이전 변수만 남은 셀을 검증합니다.
웹 테스트는 문항 유형별 피드백, 서술형의 자율 비교 표시, 코드/결과 일치와 자유 셀 저장을 검증합니다.
브라우저 Pyodide에서 실제 CSV 읽기·그래프·8개 미션·답안/노트북 저장은 별도로 확인합니다.
학교망에서 30명 이상 동시 최초 다운로드 시간은 아직 측정하지 않았습니다.

## 배포

개발 PC/CI에서 빌드한 `dist/`를 HTTPS 정적 경로(예: `/practice/`)에 배포합니다.
운영 EC2는 Python 커널을 실행하지 않으며 `.wasm`, `.whl`, `.json`, `.js`, `.csv` 전달을 허용해야 합니다.
교재와 JupyterLite는 동일 출처를 사용하고 학교망에서 패키지 CDN 접근이 가능해야 합니다.
정적 파일 요청을 HUSTOJ 재작성 규칙이 가로채지 않도록 합니다. 오프라인 패키지 전체 호스팅은 아직 구성하지 않았습니다.

## GitHub Pages 테스트 공유

`main`에 변경 내용을 push하면 `.github/workflows/pages.yml`이 교재를 생성하고 `dist/`만 Pages에 배포합니다.
빌드 전용 의존성은 `requirements-pages.txt`입니다. 원본 그림이 든 reference 노트북과 로컬 협의 기록은 공개 저장소에서 제외합니다.
교재·퀴즈는 공개 테스트용이며 로그인이나 교사 답안 수집 기능은 없습니다.
외부 자료 정보는 `THIRD_PARTY.md`를 참고하세요.

## 여러 데이터 수업을 위한 교실

첫 화면은 수업 목록·검색·주제 필터·안내 게시판입니다. 기존 펭귄 실습 주소는 `lesson.html`입니다.
`web/catalog.json`에서 공개 수업과 공지를 관리하며, `CLASSROOM_DESIGN.md`에 확장 구조를 정리했습니다.
교사 초안 화면은 브라우저 저장과 JSON 파일 이동을 지원합니다. 실제 학생 대상 게시·계정·제출 기능은 아직 없습니다.

## 직접 만드는 수업

`editor.html`에서 수업 소개, CSV(UTF-8·영문 파일명·1 MB 이하), 활동별 코드와 질문을 작성합니다.
활동 순서 변경, 객관식·단답형·서술형, 펭귄 예제 복제, 수업 복제, JSON 가져오기/내보내기를 지원합니다.
저장한 내 수업은 같은 브라우저의 수업 목록에도 표시됩니다.
`player.html`은 작성한 수업을 실제 공유 Python 커널에서 실행하고, 답안과 출력을 노트북으로 저장합니다.
작성한 내용과 정답은 JSON에 포함됩니다. 정답을 숨기는 시험이나 공식 성적 처리 용도가 아닙니다.
학생에게 JSON 파일과 player.html 링크를 전달하면 다른 PC에서도 수업 파일을 열 수 있습니다.
개인 수업 ID가 포함된 URL만 전달하면 다른 PC에서는 내용이 열리지 않습니다. 공개 게시·제출에는 서버 연결이 필요합니다.
수업 내용을 수정해 저장하면 새 버전으로 구분하여 이전 버전 학생 답안과 섞이지 않도록 합니다.
브라우저 저장 공간이 부족할 수 있으므로 파일 내보내기로 보관하세요.

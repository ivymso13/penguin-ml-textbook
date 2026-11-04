"""Inspect and copy the user's exact CSV; never replace it with another edition."""
import csv
import hashlib
import shutil
from collections import Counter
from pathlib import Path


def build_dataset_intro(root: Path):
    source = root / 'reference/penguins_size.csv'
    with source.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        names = reader.fieldnames
    definitions = [
        ('species', '펭귄의 종', '범주형', '없음', '정답 y'),
        ('island', '관측한 섬', '범주형', '없음', '배경 정보'),
        ('culmen_length_mm', '부리 길이', '수치형', 'mm', '입력 X'),
        ('culmen_depth_mm', '부리 깊이(두께)', '수치형', 'mm', '입력 X'),
        ('flipper_length_mm', '날개 길이', '수치형', 'mm', '입력 X'),
        ('body_mass_g', '몸무게', '수치형', 'g', '입력 X'),
        ('sex', '성별 표기', '범주형', '없음', '정리 연습용'),
    ]
    columns = [dict(name=n, meaning=m, kind=k, unit=u, role=r) for n,m,k,u,r in definitions]
    assert names == [c['name'] for c in columns]
    missing_value = lambda value: value in ('', 'NA', 'NaN', 'nan')
    missing = {name: sum(missing_value(r[name]) for r in rows) for name in names}
    complete = [r for r in rows if not any(missing_value(v) for v in r.values())]
    clean = [r for r in complete if r['sex'] in ('MALE', 'FEMALE')]
    counts = Counter(row['species'] for row in rows)
    preview = []
    for species in sorted(counts):
        for i, row in [(i,r) for i,r in enumerate(rows) if r['species']==species][:2]:
            preview.append(dict(row=i+1, values=[row[name] if not missing_value(row[name]) else 'NA' for name in names]))
    (root/'content').mkdir(exist_ok=True)
    shutil.copyfile(source, root/'content/penguins_size.csv')
    info = dict(filename=source.name, rowCount=len(rows), columnCount=len(names), inputCount=4,
        columns=columns, classes=[dict(name=k,count=v) for k,v in counts.items()], preview=preview,
        facts=[['실제 수업 파일',source.name],['원본 크기',f'{len(rows)}행 × {len(names)}열'],['예측 입력','수치 측정값 4개'],['예측 목표','펭귄의 종 3가지']],
        previewHeaders=['기록 번호']+[c['meaning']+(f"({c['unit']})" if c['unit']!='없음' else '') for c in columns],
        source='사용자가 제공한 reference/penguins_size.csv', sourceVersion='제공 파일 그대로 사용',
        sourceUrl='https://www.kaggle.com/datasets/parulpandey/palmer-archipelago-antarctica-penguin-data',
        sourceLabel='원본 수업 자료에 기재된 데이터 출처 ↗',
        sha256=hashlib.sha256(source.read_bytes()).hexdigest(), missing=missing,
        completeRows=len(complete), cleanRows=len(clean),
        glossary=['culmen은 부리, flipper는 날개를 가리킵니다. 길이와 깊이는 mm, 몸무게는 g 단위입니다.',
                  'species는 Adelie·Chinstrap·Gentoo 중 하나입니다. 이번에는 종 이름 문자열을 정답 y로 그대로 사용합니다.'],
        loaderNote='이 실습은 내장 데이터를 불러오지 않고 pd.read_csv("penguins_size.csv")로 제공한 파일을 직접 읽습니다. 브라우저 실행 환경이 준비될 때 같은 CSV를 Python 작업 폴더에 복사합니다.',
        properties=[['df','원본 표: 344행 × 7열'],['df.shape','(행 수, 열 수)'],['df.dtypes','열별 자료형'],['df.isna().sum()','열별 결측치 개수'],['clean','이번 기준으로 정리한 표 · 남은 기록 수는 실습에서 확인'],['X / y','측정값 4개 / 정답 종 이름']],
        notes=['CSV 첫 줄은 열 이름이며 데이터 344행에 포함하지 않습니다. NA는 빈 값으로 읽힙니다. sex의 점(.)은 결측치가 아니라 별도로 살펴볼 문자열입니다.',
               'species는 정답이므로 X에 넣지 않습니다. island와 sex는 이번 모델의 입력에서 제외합니다. 전처리 방식은 분석 목적에 따라 달라질 수 있습니다.'],
        thinkPrompt='표 한 행의 몸무게가 3750이면 단위는 무엇일까요? 예측해야 할 정답은 어느 열에 있나요?',
        thinkAnswer='3750g이며, 맞혀야 할 정답은 species 열의 종 이름입니다.')
    info['questions'] = [
        dict(id='intro-row-v1', type='choice', prompt='표의 한 행은 무엇을 기록한 걸까요?', context='아래 표에서 한 줄을 골라 읽어 보세요.',
             options=['펭귄 한 마리의 관측값', '한 섬에 사는 펭귄의 평균', '한 종의 전체 개체 수'], answer=0,
             feedback='한 행에 펭귄 한 마리의 종, 섬, 측정값, 성별이 함께 기록됩니다.'),
        dict(id='intro-unit-v1', type='choice', prompt='몸무게 3750과 날개 길이 181을 그대로 비교해도 될까요?', context='열 이름 끝의 g와 mm를 살펴보세요.',
             options=['3750이 크므로 몸무게가 더 긴 값이다', '단위와 측정 대상이 달라 숫자 크기만 비교할 수 없다', '둘 다 펭귄의 측정값이므로 같은 단위다'], answer=1,
             feedback='body_mass_g는 g, flipper_length_mm는 mm입니다. 숫자를 읽을 때 뜻과 단위도 함께 확인하세요.'),
    ]
    table = '\n'.join(f"| `{c['name']}` | {c['meaning']} | {c['unit']} |" for c in columns)
    questions = '\n\n'.join(f"### 질문 {i} · {q['prompt']}\n\n{q['context']}\n\n" + '\n'.join(f"- {o}" for o in q['options']) + f"\n\n내 답: \n\n<details><summary>해설 보기</summary>{q['feedback']}</details>" for i,q in enumerate(info['questions'],1))
    markdown=f'''## 데이터와 첫 만남

`penguins_size.csv`는 남극 펭귄의 종·서식 섬·측정값을 담은 파일입니다.

| 열 이름 | 뜻 | 단위 |
|---|---|---|
{table}

{questions}

[실습 CSV](penguins_size.csv) · [데이터 출처]({info['sourceUrl']})
'''
    return info, markdown

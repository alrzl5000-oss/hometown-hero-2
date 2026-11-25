// ============================================================================
// 게임 2.0 — 배치(포메이션) 시스템: 5인 전용으로 새로 설계
// ============================================================================
// 민수님 결정: "캐릭터 5명 배치하는 걸로 바꿔" — 팀 규모를 5명으로 고정하고, 기존
// 라이브 게임의 포메이션 개념(앞열/중열/뒷열, 앞열=방어+/뒷열=공격+/중열=둘 다 소폭)을
// 그대로 가져온다. [중요] 기존 게임의 FORMATIONS는 4인 기준(front+mid+back=4)이라
// 비율을 그대로 복붙할 수 없어서, 같은 "균형/공세/철벽" 컨셉을 5인에 맞게 새로 짰다.
//
// 편성 순서(유저가 고른 순서)의 앞쪽 N명이 앞열, 그다음 M명이 중열, 나머지가 뒷열이 된다.
export const FRONT_DEF_BONUS = 0.2; // 앞열: 방어력 +20% (버티는 용도)
export const BACK_ATK_BONUS = 0.15; // 뒷열: 공격력 +15% (안전하게 공격하는 용도)
export const MID_DEF_BONUS = 0.08; // 중열: 방어력 +8% (앞열보다는 약하지만 어느 정도 버팀)
export const MID_ATK_BONUS = 0.06; // 중열: 공격력 +6% (뒷열보다는 약하지만 어느 정도 화력)

export const FORMATIONS = {
  balanced: { label: "균형진", desc: "앞열 2 / 중열 2 / 뒷열 1 — 무난하게 밸런스가 좋은 배치", front: 2, mid: 2, back: 1 },
  offensive: { label: "공세진", desc: "앞열 1 / 중열 1 / 뒷열 3 — 화력은 세지만 앞열이 금방 무너질 수 있음", front: 1, mid: 1, back: 3 },
  defensive: { label: "철벽진", desc: "앞열 3 / 중열 1 / 뒷열 1 — 오래 버티지만 화력이 낮음", front: 3, mid: 1, back: 1 },
};
export const DEFAULT_FORMATION = "balanced";
export const TEAM_SIZE = 5; // 최대 인원
export const MIN_TEAM_SIZE = 1; // 초반엔 영웅이 적으니 1명부터 편성 가능(빈 자리는 비워 둔 채로 싸움)
export const okTeam = (ids) => Array.isArray(ids) && ids.length >= MIN_TEAM_SIZE && ids.length <= TEAM_SIZE;

// teamOrdered: 편성 순서대로 정렬된 5인 배열(characterStatsAt 결과 또는 그와 동등한
// {atk, def, ...} 객체). 각 원소에 row("front"/"mid"/"back")를 붙이고, 그 열의 보너스를
// atk/def에 바로 곱해서 반환한다 — 원본 배열/객체는 변형하지 않는다(불변 유지).
export function assignFormation(teamOrdered, formationKey = DEFAULT_FORMATION) {
  const formation = FORMATIONS[formationKey] || FORMATIONS[DEFAULT_FORMATION];
  const midEnd = (formation.front || 0) + (formation.mid || 0);
  return teamOrdered.map((hero, idx) => {
    if (!hero) return hero;
    const row = idx < formation.front ? "front" : idx < midEnd ? "mid" : "back";
    const atkMult = row === "back" ? 1 + BACK_ATK_BONUS : row === "mid" ? 1 + MID_ATK_BONUS : 1;
    const defMult = row === "front" ? 1 + FRONT_DEF_BONUS : row === "mid" ? 1 + MID_DEF_BONUS : 1;
    return { ...hero, row, atk: Math.round(hero.atk * atkMult), def: Math.round(hero.def * defMult) };
  });
}

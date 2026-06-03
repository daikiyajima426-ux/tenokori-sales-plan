export const yen = (value: number) =>
  `${Math.round(value).toLocaleString("ja-JP")}円`;

export const kg = (value: number) =>
  `${round(value).toLocaleString("ja-JP")}kg`;

export const perKg = (value: number) =>
  `${Math.round(value).toLocaleString("ja-JP")}円/kg`;

export const round = (value: number) => Math.round(value * 10) / 10;

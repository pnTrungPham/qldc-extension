/** Lowercase and accent-free, so "Họ và tên" and "ho va ten" compare equal. Also what resident search folds to. */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

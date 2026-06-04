import type { SponsorRecord } from "./types";

export const STARTUP_FUNDING_PROGRAM_NAME = "启动资金";

const ROOT_UNIT_DIVISOR = 100;
const CHINESE_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
const CHINESE_SECTION_UNITS = ["", "万", "亿"] as const;
const CHINESE_PLACE_UNITS = ["", "十", "百", "千"] as const;

const roundedRootUnits = (amount: number): number => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return Math.round((safeAmount / ROOT_UNIT_DIVISOR) * 10) / 10;
};

export const formatRootUnits = (amount: number): string => {
  const rootUnits = roundedRootUnits(amount);
  const formatted = rootUnits.toLocaleString("zh-CN", {
    minimumFractionDigits: Number.isInteger(rootUnits) ? 0 : 1,
    maximumFractionDigits: 1
  });

  return `${formatted}根`;
};

export const formatRootUnitsForSpeech = (amount: number): string => {
  const rootUnits = roundedRootUnits(amount);
  const tenths = Math.round(Math.abs(rootUnits) * 10);
  const integerPart = Math.trunc(tenths / 10);
  const decimalDigit = tenths % 10;
  const signText = rootUnits < 0 ? "负" : "";
  const numberText =
    decimalDigit === 0
      ? formatChineseRootUnitIntegerForSpeech(integerPart)
      : `${formatChineseRootUnitIntegerForSpeech(integerPart)}点${CHINESE_DIGITS[decimalDigit]}`;

  return `${signText}${numberText}根`;
};

const formatChineseRootUnitIntegerForSpeech = (value: number): string => {
  return value === 2 ? "两" : formatChineseInteger(value);
};

const formatChineseInteger = (value: number): string => {
  if (value === 0) {
    return CHINESE_DIGITS[0];
  }

  const sections: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    sections.push(remaining % 10000);
    remaining = Math.trunc(remaining / 10000);
  }

  let result = "";
  let needsZero = false;
  for (let index = sections.length - 1; index >= 0; index -= 1) {
    const section = sections[index];
    if (section === 0) {
      needsZero = result.length > 0;
      continue;
    }

    if (needsZero || (result.length > 0 && section < 1000)) {
      result += CHINESE_DIGITS[0];
    }
    result += `${formatChineseSection(section)}${CHINESE_SECTION_UNITS[index] ?? ""}`;
    needsZero = false;
  }

  return result;
};

const formatChineseSection = (section: number): string => {
  let result = "";
  let needsZero = false;

  for (let position = 3; position >= 0; position -= 1) {
    const placeValue = 10 ** position;
    const digit = Math.trunc(section / placeValue) % 10;
    if (digit === 0) {
      if (result.length > 0 && section % placeValue !== 0) {
        needsZero = true;
      }
      continue;
    }

    if (needsZero) {
      result += CHINESE_DIGITS[0];
      needsZero = false;
    }
    if (!(digit === 1 && position === 1 && result.length === 0)) {
      result += CHINESE_DIGITS[digit];
    }
    result += CHINESE_PLACE_UNITS[position];
  }

  return result;
};

export const neutralizePublicText = (text: string): string => {
  return text
    .replace(/感谢/g, "")
    .replace(/赞助/g, "点亮")
    .replace(/金额/g, "进度")
    .replace(/老板/g, "大哥")
    .replace(/[¥￥楼]/g, "")
    .trim();
};

export const formatDisplayName = (name: string): string => {
  return neutralizePublicText(name);
};

export const formatDisplayNameWithTitle = (name: string): string => {
  const displayName = formatDisplayName(name);
  return displayName.endsWith("大哥") ? displayName : `${displayName}大哥`;
};

export const buildRootUnitActionText = (name: string, amount: number): string => {
  return `${formatDisplayNameWithTitle(name)} 点亮 ${formatRootUnits(amount)}`;
};

export const buildRootUnitSpeechText = (name: string, amount: number, detail: string): string => {
  const neutralDetail = neutralizePublicText(detail);
  const baseText = `${formatDisplayNameWithTitle(name)}，点亮 ${formatRootUnitsForSpeech(amount)}`;

  return neutralDetail ? `${baseText}，${neutralDetail}` : baseText;
};

export const buildSponsorSpeechText = (record: SponsorRecord): string => {
  const details = [record.programName, record.note]
    .map((item) => neutralizePublicText(item ?? ""))
    .filter((item) => item.length > 0);
  const baseText = `${formatDisplayNameWithTitle(record.bossName)}，点亮 ${formatRootUnitsForSpeech(record.amount)}`;

  return details.length > 0 ? `${baseText}，${details.join("，")}` : baseText;
};

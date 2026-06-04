import type { SponsorRecord } from "./types";

export const STARTUP_FUNDING_PROGRAM_NAME = "启动资金";

const ROOT_UNIT_DIVISOR = 100;

export const formatRootUnits = (amount: number): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const rootUnits = Math.round((safeAmount / ROOT_UNIT_DIVISOR) * 100) / 100;
  const formatted = rootUnits.toLocaleString("zh-CN", {
    minimumFractionDigits: Number.isInteger(rootUnits) ? 0 : 2,
    maximumFractionDigits: 2
  });

  return `${formatted}根`;
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
  const baseText = `${formatDisplayNameWithTitle(name)}，点亮 ${formatRootUnits(amount)}`;

  return neutralDetail ? `${baseText}，${neutralDetail}` : baseText;
};

export const buildSponsorSpeechText = (record: SponsorRecord): string => {
  const details = [record.programName, record.note]
    .map((item) => neutralizePublicText(item ?? ""))
    .filter((item) => item.length > 0);
  const baseText = `${formatDisplayNameWithTitle(record.bossName)}，点亮 ${formatRootUnits(record.amount)}`;

  return details.length > 0 ? `${baseText}，${details.join("，")}` : baseText;
};

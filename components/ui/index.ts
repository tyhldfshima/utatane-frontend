// 共通の見た目部品（docs/design/utatane-focus-screens-spec.md が正本）。
// ★PrimaryButton は出さない（主ボタンは ScreenFrame の primary と ConfirmDialog の確認だけ）。
export { UtataneTheme } from './Theme'
export { Icon, ICON_NAMES, type IconName } from './Icon'
export { SecondaryButton, GhostButton, UnavailableButton, BusyButton, type ActionProps } from './Button'
export { ScreenFrame, type ScreenFrameProps, type PrimarySlot } from './ScreenFrame'
export { StateView, type StateKind, type StateViewProps } from './StateView'
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog'
export { giftGate, Y4_PHASE, type Y4Phase, type GiftGate, type GiftGateInput } from './y4'
export { COPY } from './copy'
export { COLORS, FONT_FAMILY, SIZES, CONTRAST_PAIRS, contrastRatio } from './tokens'
export { InquiryButton } from './InquiryButton'
export { startInquiry, takeInquiry, INQUIRY_PATH, INQUIRY_STORAGE_KEY, type InquiryHandoff } from './inquiry'

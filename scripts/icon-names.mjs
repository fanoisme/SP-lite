export const ICON_NAMES = Object.freeze([
  'account_balance', 'account_circle', 'account_tree', 'add',
  'admin_panel_settings', 'alternate_email', 'apps', 'arrow_back',
  'arrow_downward', 'arrow_forward', 'arrow_upward', 'aspect_ratio',
  'auto_awesome', 'auto_fix_high', 'autorenew', 'badge', 'barcode', 'bolt',
  'calendar_month', 'check', 'check_box', 'check_box_outline_blank',
  'check_circle', 'chevron_left', 'chevron_right', 'close', 'cloud_upload',
  'code', 'content_copy', 'content_paste', 'construction', 'dashboard', 'data_object',
  'delete', 'delete_sweep', 'description', 'deselect', 'dns', 'download',
  'download_done', 'edit', 'edit_note', 'edit_off', 'error', 'event',
  'event_available', 'event_upcoming', 'expand_less', 'expand_more',
  'file_download', 'file_save', 'filter_alt', 'filter_alt_off', 'flare',
  'font_download', 'format_align_center', 'format_align_justify',
  'format_align_left', 'format_align_right', 'format_bold', 'format_italic',
  'format_size', 'format_underlined', 'group', 'group_off', 'hard_drive_2',
  'help', 'history', 'history_toggle_off', 'hourglass_bottom',
  'hourglass_empty', 'hourglass_top', 'inbox', 'info', 'inventory', 'ios_share',
  'key', 'lock', 'logout', 'mail', 'menu', 'movie', 'palette', 'person',
  'person_add', 'picture_as_pdf', 'play_arrow', 'preview', 'qr_code_2',
  'qr_code_scanner', 'refresh', 'remove', 'report', 'restart_alt', 'save',
  'schedule', 'search', 'select_all', 'sell', 'shield_person', 'storefront',
  'sync_problem', 'table_rows', 'terminal', 'transform', 'tune',
  'unfold_more', 'upload', 'upload_file', 'verified', 'video_file',
  'videocam', 'view_column', 'view_list', 'visibility', 'visibility_off',
  'warning',
])

export const FILLED_ICON_NAMES = Object.freeze(['check'])

export function assetFilename(name, filled = false) {
  return `${name.replaceAll('_', '-')}${filled ? '-fill' : ''}.svg`
}

export const LIMITS = {
    screen_tiltMin: -120, // Degrees
    screen_tiltMax: 120,
    screen_zoomMin: 1.0,  // Distance (positive)
    screen_zoomMax: 10.0,
    screen_eye_sepMin: -0.15,
    screen_eye_sepMax: 0.15,
    screen_txMax: 0.5,
    screen_tyMax: 0.5,
    screen_curvatureMin: 0.0,
    screen_curvatureMax: 1.0,
    screen_edge_fadeMin: 0.0,
    screen_edge_fadeMax: 0.25,
    screen_bg_colorMin: 0.0,
    screen_bg_colorMax: 1.0,
    color_brightnessMin: 0.0,
    color_brightnessMax: 2.0,
    color_contrastMin: 0.0,
    color_contrastMax: 2.0,
    color_gammaMin: 0.5,
    color_gammaMax: 2.5,
    color_saturationMin: 0.0,
    color_saturationMax: 2.0,
    color_hueMin: -45,
    color_hueMax: 45,
    environment_rotationMin: 0,
    environment_rotationMax: 360,
    environment_tiltMin: -90,
    environment_tiltMax: 90,
    environment_distanceMin: 1,
    environment_distanceMax: 50,
    environment_intensityMin: -6.0,
    environment_intensityMax: 6.0,
    subtitle_yMin: -1.0,
    subtitle_yMax: 1.0,
    subtitle_zMin: -1.0, // Offset from screen
    subtitle_zMax: 4.0,
    subtitle_font_sizeMin: 0.5,
    subtitle_font_sizeMax: 2.0,
    subtitle_eye_sepMin: -0.15,
    subtitle_eye_sepMax: 0.15,
    screen_height_indexMin: 0.0, // 2^0 = 1m
    screen_height_indexMax: 4.0, // 2^4 = 16m
    screen_scaleMin: 1.0,
    screen_scaleMax: 16.0
};

export const DEFAULTS = {
    screen_tilt: 0,
    screen_zoom: -3.0,
    screen_eye_sep: 0.0,
    screen_tx: 0.0,
    screen_ty: 0.0,
    screen_curvature: 0.1,
    screen_edge_fade: 0.0,
    screen_bg_color: 0.0,
    screen_height_index: 1.0, // 2^1 = 2m
    screen_volume: 0.5,

    environment_name: "None",
    environment_model_name: "None",
    environment_rotation: 0,
    environment_tilt: 0,
    environment_distance: 50,
    environment_intensity: 0.0,
    environment_ambient_min: 0.03,
    uiZ: -0.9,
    uiForwardLimit: 0.09,
    
    color_brightness: 1.0,
    color_contrast: 1.0,
    color_gamma: 1.0,
    color_saturation: 1.0,
    color_hue: 0.0,
    color_lut: "None",

    video_repeat: true,

    render_video_mipmap: true,
    render_antialias: true,
    render_ss: 2.0,
    render_fps: 0,
    render_font: 'Auto',

    menu_alignment: 'right',

    subtitle_visible: true,
    subtitle_y: -0.5,
    subtitle_z: 0.5,
    subtitle_font_size: 1.25,
    subtitle_eye_sep: 0.0
};


export const UI_CONFIG = {
    pixelSize: 0.001,
    occlusionTimeConstant: 250, // ms
    occlusionHysteresisFar: 0.05,
    occlusionHysteresisNear: 0.10,
    hapticHoverIntensity: 0.3,
    hapticHoverDuration: 10,
    hapticClickIntensity: 0.6,
    hapticClickDuration: 25,
    hapticLimitIntensity: 0.5,
    hapticLimitDuration: 15,
    translationSensitivity: 3.33,
    eyeSeparationSensitivity: 0.125,
    eyeSeparationSensitivityMin: 0.01875,
    menuMarginTop: -1080,
    menuMarginLeft: 450
};

export const STEREO_FORMATS = {
    SBS_FULL: "SBS_FULL",
    SBS_HALF: "SBS_HALF",
    SBS_FULL_CROSS: "SBS_FULL_CROSS",
    TB_FULL: "TB_FULL",
    TB_HALF: "TB_HALF",
    FLAT: "FLAT"
};

export const VR_CONFIG = {
    framebufferScaleFactor: 2.0,
    screenSegments: 64
};

export const PREFETCH_CONFIG = {
    count: 3,
    maxSize: 10
};

export const FONT_CONFIG = {
    fontFamilies: {
        NotoSansJP: { 400: '/fonts/NotoSansJP.json' },
        NotoSansSC: { 400: '/fonts/NotoSansSC.json' },
        NotoSansTC: { 400: '/fonts/NotoSansTC.json' },
        NotoSans: { 400: '/fonts/NotoSans.json' },
        NotoSansKR: { 400: '/fonts/NotoSansKR.json' }
    }
};

export const COLORS = {
    bg: 0x111111,
    bgDark: 0x080808,
    accent: 0x6666cc,
    accentHover: 0x8080cc,
    hover: 0x666666,
    text: 0xeeeeee,
    textDim: 0xcccccc,
    button: 0x222222,
    buttonDisabled: 0x111111,
    track: 0x333333,
    thumb: 0xeeeeee,
    separator: 0x333333,
    border: 0x333333,
    bgTarget: 0xffffff,
    hint: 0xccccff,
    recent: 0x4444aa,
    recentHover: 0x5555bb,
    explorerActive: 0x333333
};

export const INPUT_ACTIONS = {
    MENU_TOGGLE: 'MENU_TOGGLE',
    NAV_NEXT: 'NAV_NEXT',
    NAV_PREV: 'NAV_PREV',
    PAGE_NEXT: 'PAGE_NEXT',
    PAGE_PREV: 'PAGE_PREV',
    ZOOM_IN: 'ZOOM_IN',
    ZOOM_OUT: 'ZOOM_OUT',
    EYE_SEP_INC: 'EYE_SEP_INC',
    EYE_SEP_DEC: 'EYE_SEP_DEC',
    SCREEN_SIZE_INC: 'SCREEN_SIZE_INC',
    SCREEN_SIZE_DEC: 'SCREEN_SIZE_DEC',
    SEEK_FWD: 'SEEK_FWD',
    SEEK_BWD: 'SEEK_BWD',
    PLAY_PAUSE: 'PLAY_PAUSE',
    SELECT: 'SELECT',
    CANCEL: 'CANCEL',
    DRAG_START: 'DRAG_START',
    DRAG_END: 'DRAG_END'
};

/**
 * Metadata for all settings to handle global/file-specific logic and UI conversions in one place.
 */
export const SETTINGS_METADATA = {
    // Key is the ID used in file-specific configs
    screen_height: { 
        uiKey: 'screen_height_index', 
        isFileSpecific: true,
        group: 'screen',
        toUI: v => Math.round(Math.log2(v)),
        fromUI: v => Math.pow(2, Math.round(v))
    },
    screen_zoom: { uiKey: 'screen_zoom', isFileSpecific: true, group: 'screen' },
    screen_eye_sep: { uiKey: 'screen_eye_sep', isFileSpecific: true, group: 'screen' },
    screen_tx: { uiKey: 'screen_tx', group: 'screen' },
    screen_ty: { uiKey: 'screen_ty', group: 'screen' },
    screen_tilt: { uiKey: 'screen_tilt', group: 'screen' },
    subtitle_visible: { uiKey: 'subtitle_visible', isFileSpecific: true, group: 'subtitle' },
    subtitle_y: { uiKey: 'subtitle_y', isFileSpecific: true, group: 'subtitle' },
    subtitle_z: { uiKey: 'subtitle_z', isFileSpecific: true, group: 'subtitle' },
    subtitle_font_size: { uiKey: 'subtitle_font_size', isFileSpecific: true, group: 'subtitle' },
    subtitle_eye_sep: { uiKey: 'subtitle_eye_sep', isFileSpecific: true, group: 'subtitle' },
    subtitle_index: { isFileSpecific: true, isInternal: true, group: 'subtitle' }, 
    playback_time: { isFileSpecific: true, isInternal: true, group: 'playback' },
    stereo_format: { isFileSpecific: true, isInternal: true, group: 'format' }
};


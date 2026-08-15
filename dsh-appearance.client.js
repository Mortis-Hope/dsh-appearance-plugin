// dsh-appearance — DeepSeek Harness 外观插件(Client 半)
// =============================================================
// 这是 cordis_define 的 `code.client` 取值:一个纯 JavaScript
// 函数体,返回 Cordis 插件对象。无 JSX、无 TypeScript、无 import。
//
// 使用方法见同目录 README.md。
//
// 功能:
//   - 配色方案:默认 / 霓虹(蓝黑+青)/ 清爽(浅色+蓝),明暗自适应
//   - 渐变背景:两个端点色(原生取色器 + RGB 数字输入)+ 角度
//   - 图片/视频壁纸:本地文件导入,透明度/暗化调节
//   - 对话框设置:玻璃输入框(透明度/模糊强度/渐变边框)实时调节
//   - 设置入口:设置 →「外观」;背景承载层挂在 shell.overlay
// =============================================================

return {
  apply(ctx) {
    const slots = ctx.get('slots')
    const theme = ctx.get('theme')
    if (slots === undefined || theme === undefined) return

    // ---- 配色方案:每个 token 提供 light/dark 双值,跟随系统明暗 ----
    const PALETTES = {
      default: {},
      neon: {
        '--dsw-alias-bg-base': { light: '#eef2f8', dark: '#0a0e17' },
        '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#101724' },
        '--dsw-alias-bg-layer-2': { light: '#e8eef7', dark: '#182136' },
        '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#0d1420' },
        '--dsw-alias-border-l1': { light: '#d7e0ee', dark: '#22304a' },
        '--dsw-alias-border-l2': { light: '#c3d0e4', dark: '#31425f' },
        '--dsw-alias-brand-primary': { light: '#06b6d4', dark: '#22d3ee' },
        '--dsw-alias-label-primary': { light: '#14233c', dark: '#e6edf8' },
        '--dsw-alias-label-secondary': { light: '#5d6d88', dark: '#8b9cb8' },
        '--dsw-alias-state-error-primary': { light: '#ef4444', dark: '#f87171' },
        '--dsw-alias-state-success-primary': { light: '#10b981', dark: '#34d399' },
        '--dsw-alias-state-warn-primary': { light: '#f59e0b', dark: '#fbbf24' },
        '--dsw-specific-sidebar-fill': { light: '#e3eaf5', dark: '#0c1220' },
      },
      fresh: {
        '--dsw-alias-bg-base': { light: '#f6f7f9', dark: '#14161b' },
        '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#1b1e24' },
        '--dsw-alias-bg-layer-2': { light: '#eef0f3', dark: '#23262e' },
        '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#1e2128' },
        '--dsw-alias-border-l1': { light: '#e0e3e8', dark: '#2b2f38' },
        '--dsw-alias-border-l2': { light: '#cdd2da', dark: '#3a3f4a' },
        '--dsw-alias-brand-primary': { light: '#2563eb', dark: '#60a5fa' },
        '--dsw-alias-label-primary': { light: '#1b2430', dark: '#e9ebef' },
        '--dsw-alias-label-secondary': { light: '#66717f', dark: '#9aa1ad' },
        '--dsw-alias-state-error-primary': { light: '#dc2626', dark: '#f87171' },
        '--dsw-alias-state-success-primary': { light: '#16a34a', dark: '#4ade80' },
        '--dsw-alias-state-warn-primary': { light: '#d97706', dark: '#fbbf24' },
        '--dsw-specific-sidebar-fill': { light: '#e9ebef', dark: '#171a20' },
      },
    }

    // ---- 壁纸模式下需要半透明化的表面及其 alpha ----
    const TINT_ALPHAS = {
      '--dsw-alias-bg-base': 0.5,
      '--dsw-specific-sidebar-fill': 0.55,
      '--dsw-alias-bg-overlay': 0.85,
    }

    // ---- 颜色工具 ----
    function parseColor(input) {
      const s = String(input).trim()
      if (s.startsWith('#')) {
        let hex = s.slice(1)
        if (hex.length === 3) hex = hex.split('').map(function (ch) { return ch + ch }).join('')
        if (hex.length !== 6) return null
        const n = parseInt(hex, 16)
        if (Number.isNaN(n)) return null
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
      }
      const m = s.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const parts = m[1].split(',').map(function (v) { return parseFloat(v) })
      if (parts.length < 3 || parts.slice(0, 3).some(function (v) { return Number.isNaN(v) })) return null
      return { r: parts[0], g: parts[1], b: parts[2] }
    }
    function withAlpha(color, alpha) {
      const p = parseColor(color)
      if (!p) return color
      return 'rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', ' + alpha + ')'
    }

    // ---- 轻量状态 store ----
    const store = {
      state: {
        palette: 'default', wallpaper: null, opacity: 0.85, dim: 0.2,
        glassEnabled: true, glassAlpha: 0.28, glassBlur: 32, glassBorder: true,
      },
      listeners: new Set(),
      getState: function () { return this.state },
      setState: function (patch) {
        this.state = Object.assign({}, this.state, patch)
        this.listeners.forEach(function (fn) { fn() })
      },
      subscribe: function (fn) {
        this.listeners.add(fn)
        return function () { this.listeners.delete(fn) }.bind(this)
      },
    }

    // ---- 读取默认主题各 token 的 light/dark 实际值 ----
    function readTokenPair(name) {
      const body = document.body
      const wasDark = body.hasAttribute('data-ds-dark-theme')
      const light = getComputedStyle(body).getPropertyValue(name).trim()
      body.toggleAttribute('data-ds-dark-theme', true)
      const dark = getComputedStyle(body).getPropertyValue(name).trim()
      body.toggleAttribute('data-ds-dark-theme', wasDark)
      return { light: light, dark: dark }
    }
    // 惰性读取并缓存:仅在需要时读取(此时页面主题变量必然已就绪)
    const baseTokens = {}
    function ensureBaseTokens() {
      for (const name of Object.keys(TINT_ALPHAS)) {
        const cached = baseTokens[name]
        if (cached && cached.light && cached.dark) continue
        baseTokens[name] = readTokenPair(name)
      }
    }
    function readBrandLight() {
      const pair = readTokenPair('--dsw-alias-brand-primary')
      return (pair && pair.light) ? pair.light : '#2563eb'
    }

    // ---- 主题覆盖:配色 + 背景半透明化 合成同一层 ----
    let disposeLayer = null
    ctx.effect(function () {
      const apply = function () {
        const tokens = Object.assign({}, PALETTES[store.state.palette])
        if (store.state.wallpaper) {
          ensureBaseTokens()
          for (const name of Object.keys(TINT_ALPHAS)) {
            const pair = baseTokens[name]
            if (!pair || !pair.light || !pair.dark) continue
            const alpha = TINT_ALPHAS[name]
            tokens[name] = { light: withAlpha(pair.light, alpha), dark: withAlpha(pair.dark, alpha) }
          }
        }
        disposeLayer = theme.overrideTokens('dsh-appearance', tokens)
      }
      apply()
      const unsub = store.subscribe(apply)
      return function () {
        unsub()
        if (disposeLayer) disposeLayer()
      }
    })

    // ---- 玻璃输入框 CSS:按 store 状态实时生成 ----
    function glassCss(s) {
      if (!s.glassEnabled) return ''
      const a = s.glassAlpha
      const blurRule = s.glassBlur > 0
        ? 'backdrop-filter:blur(' + s.glassBlur + 'px) saturate(150%)!important;-webkit-backdrop-filter:blur(' + s.glassBlur + 'px) saturate(150%)!important;'
        : ''
      var lightBg, darkBg, lightBorder, darkBorder
      if (s.glassBorder) {
        lightBg = 'linear-gradient(rgba(255,255,255,' + a + '),rgba(255,255,255,' + a + ')) padding-box,linear-gradient(135deg,rgba(255,255,255,0.8),rgba(255,255,255,0.12) 40%,rgba(255,255,255,0.55)) border-box'
        darkBg = 'linear-gradient(rgba(8,13,22,' + a + '),rgba(8,13,22,' + a + ')) padding-box,linear-gradient(135deg,rgba(34,211,238,0.85),rgba(255,255,255,0.05) 40%,rgba(139,92,246,0.85)) border-box'
        lightBorder = '1px solid transparent'
        darkBorder = '1px solid transparent'
      } else {
        lightBg = 'rgba(255,255,255,' + a + ')'
        darkBg = 'rgba(8,13,22,' + a + ')'
        lightBorder = '1px solid rgba(255,255,255,0.35)'
        darkBorder = '1px solid rgba(255,255,255,0.14)'
      }
      return '[data-composer-card]{background:' + lightBg + '!important;' + blurRule + 'border:' + lightBorder + '!important;box-shadow:0 8px 32px rgba(0,0,0,0.15)!important;}'
        + 'body[data-ds-dark-theme] [data-composer-card]{background:' + darkBg + '!important;border:' + darkBorder + '!important;box-shadow:0 8px 40px rgba(0,0,0,0.4)!important;}'
    }
    ctx.effect(function () {
      const tag = document.createElement('style')
      tag.dataset.dshGlass = 'true'
      document.head.append(tag)
      const render = function () { tag.textContent = glassCss(store.getState()) }
      render()
      const unsub = store.subscribe(render)
      return function () { unsub(); tag.remove() }
    })

    // ---- 注入样式:overlay 降层 + 控件美化 ----
    ctx.effect(function () {
      return styles.insert(
        '[data-shell-overlay] { z-index: -1 !important; }\n'
        + '[data-dsh-appearance] input[type=\'range\'] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l2); outline: none; }\n'
        + '[data-dsh-appearance] input[type=\'range\']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-brand-primary); border: 2px solid var(--dsw-alias-bg-layer-1); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); cursor: pointer; }\n'
        + '[data-dsh-appearance] input[type=\'range\']::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: var(--dsw-alias-brand-primary); border: 2px solid var(--dsw-alias-bg-layer-1); cursor: pointer; }\n'
        + '[data-dsh-appearance] input[type=\'number\']::-webkit-outer-spin-button, [data-dsh-appearance] input[type=\'number\']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }\n'
        + '[data-dsh-appearance] input[type=\'number\'] { -moz-appearance: textfield; }\n'
        + '[data-dsh-appearance] [data-upload-tile]:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-brand-primary); }\n'
      )
    })

    // ---- React 组件 ----
    function useStore() {
      const pair = React.useState(store.getState())
      React.useEffect(function () { return store.subscribe(function () { pair[1](store.getState()) }) }, [])
      return pair[0]
    }

    // 背景承载层:image / video / gradient 三种来源
    function WallpaperLayer() {
      const state = useStore()
      const w = state.wallpaper
      if (!w) return null
      let media
      if (w.type === 'video') {
        media = React.createElement('video', { src: w.url, autoPlay: true, loop: true, muted: true, playsInline: true, style: { width: '100%', height: '100%', objectFit: 'cover', opacity: state.opacity, display: 'block' } })
      } else if (w.type === 'image') {
        media = React.createElement('img', { src: w.url, style: { width: '100%', height: '100%', objectFit: 'cover', opacity: state.opacity, display: 'block' } })
      } else {
        media = React.createElement('div', { style: { position: 'absolute', inset: 0, background: w.url, opacity: state.opacity } })
      }
      const children = [media]
      if (state.dim > 0) {
        children.push(React.createElement('div', { key: 'dim', style: { position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, ' + state.dim + ')' } }))
      }
      return React.createElement('div', { 'data-dsh-wallpaper': '', style: { position: 'absolute', inset: 0, overflow: 'hidden' } }, children)
    }

    // 小工具
    function Card(props) {
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, padding: 12, borderRadius: 10, border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)' } }, props.children)
    }
    function CardTitle(props) {
      return React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, props.children)
    }
    function Hint(props) {
      return React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, props.children)
    }
    // 开关行
    function SwitchRow(props) {
      return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('span', { style: { fontSize: 13, color: 'var(--dsw-alias-label-primary)' } }, props.label),
        React.createElement('span', { style: { flex: 1 } }),
        React.createElement('button', {
          onClick: function () { props.onChange(!props.value) },
          style: {
            width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
            background: props.value ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)',
            transition: 'background 0.15s',
          },
        },
          React.createElement('span', { style: {
            position: 'absolute', top: 2, left: props.value ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
            background: '#ffffff', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)', transition: 'left 0.15s',
          } }),
        ),
      )
    }
    // 带后缀的滑杆行
    function SliderRow(props) {
      return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('span', { style: { fontSize: 12, width: 56, color: 'var(--dsw-alias-label-secondary)' } }, props.label),
        React.createElement('input', { type: 'range', min: props.min, max: props.max, step: props.step, value: props.value, onChange: function (e) { props.onChange(parseFloat(e.target.value)) }, style: { flex: 1 } }),
        React.createElement('span', { style: { fontSize: 12, width: 44, textAlign: 'right', color: 'var(--dsw-alias-label-secondary)' } }, props.value + props.suffix),
      )
    }

    // 对话框设置:玻璃输入框调节
    function GlassSection() {
      const state = useStore()
      const set = function (patch) { store.setState(patch) }
      return React.createElement(Card, null,
        React.createElement(CardTitle, null, '对话框设置'),
        React.createElement(SwitchRow, { label: '玻璃输入框', value: state.glassEnabled, onChange: function (v) { set({ glassEnabled: v }) } }),
        state.glassEnabled ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          React.createElement(SliderRow, {
            label: '透明度', min: 10, max: 90, step: 5, suffix: '%',
            value: Math.round((1 - state.glassAlpha) * 100),
            onChange: function (v) { set({ glassAlpha: Math.max(0.1, Math.min(0.9, 1 - v / 100)) }) },
          }),
          React.createElement(SliderRow, {
            label: '模糊强度', min: 0, max: 60, step: 2, suffix: 'px',
            value: state.glassBlur,
            onChange: function (v) { set({ glassBlur: v }) },
          }),
          React.createElement(SwitchRow, { label: '渐变边框', value: state.glassBorder, onChange: function (v) { set({ glassBorder: v }) } }),
        ) : null,
      )
    }

    // 配色方案:带色点的紧凑按钮
    function PaletteSection() {
      const state = useStore()
      const set = function (patch) { store.setState(patch) }
      const defs = [
        { id: 'default', title: '默认', dot: readBrandLight() },
        { id: 'neon', title: '霓虹', dot: '#06b6d4' },
        { id: 'fresh', title: '清爽', dot: '#2563eb' },
      ]
      return React.createElement(Card, null,
        React.createElement(CardTitle, null, '配色方案'),
        React.createElement('div', { style: { display: 'flex', gap: 8 } }, defs.map(function (def) {
          const active = state.palette === def.id
          return React.createElement('button', {
            key: def.id,
            onClick: function () { set({ palette: def.id }) },
            style: {
              flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '7px 0', borderRadius: 8,
              border: active ? '1.5px solid var(--dsw-alias-brand-primary)' : '1px solid var(--dsw-alias-border-l1)',
              background: active ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
              fontFamily: 'inherit', fontSize: 13,
              color: active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
              transition: 'border-color 0.15s, background 0.15s',
            },
          },
            React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: def.dot, boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.15)' } }),
            def.title,
          )
        })),
        React.createElement(Hint, null, '明暗双模式自动跟随系统'),
      )
    }

    // 渐变编辑器:取色器 + RGB 数字 + 角度
    function GradientEditor() {
      const state = useStore()
      const set = function (patch) { store.setState(patch) }
      const parsed = state.wallpaper && state.wallpaper.type === 'gradient' ? parseGradient(state.wallpaper.url) : null
      const [c1, setC1] = React.useState(parsed ? parsed.c1 : { r: 10, g: 14, b: 23 })
      const [c2, setC2] = React.useState(parsed ? parsed.c2 : { r: 34, g: 211, b: 238 })
      const [angle, setAngle] = React.useState(parsed ? parsed.angle : 135)
      const clamp = function (v) { return Math.max(0, Math.min(255, v)) }
      const toHex = function (c) {
        return '#' + [c.r, c.g, c.b].map(function (v) { return v.toString(16).padStart(2, '0') }).join('')
      }
      const fromHex = function (hex) {
        const n = parseInt(hex.slice(1), 16)
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
      }
      const numField = function (value, onChange) {
        return React.createElement('input', {
          type: 'number', min: 0, max: 255, value: value, onChange: onChange,
          style: { width: 44, padding: '3px 4px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', fontFamily: 'inherit', fontSize: 12, textAlign: 'center' },
        })
      }
      const rgbRow = function (label, color, onColor) {
        const field = function (key) {
          return numField(color[key], function (e) {
            const v = parseInt(e.target.value, 10)
            const next = Object.assign({}, color)
            next[key] = Number.isNaN(v) ? 0 : clamp(v)
            onColor(next)
          })
        }
        return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('input', {
            type: 'color', value: toHex(color),
            onChange: function (e) { onColor(fromHex(e.target.value)) },
            style: { width: 38, height: 26, padding: 0, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, background: 'transparent', cursor: 'pointer' },
          }),
          React.createElement('span', { style: { fontSize: 12, width: 44, color: 'var(--dsw-alias-label-secondary)' } }, label),
          field('r'), field('g'), field('b'),
        )
      }
      const cssGradient = 'linear-gradient(' + angle + 'deg, rgb(' + c1.r + ', ' + c1.g + ', ' + c1.b + '), rgb(' + c2.r + ', ' + c2.g + ', ' + c2.b + '))'
      const isGradient = state.wallpaper && state.wallpaper.type === 'gradient'
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        rgbRow('颜色 1', c1, setC1),
        rgbRow('颜色 2', c2, setC2),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { fontSize: 12, width: 44, color: 'var(--dsw-alias-label-secondary)' } }, '角度'),
          React.createElement('input', { type: 'range', min: 0, max: 360, step: 5, value: angle, onChange: function (e) { setAngle(parseInt(e.target.value, 10)) }, style: { flex: 1 } }),
          React.createElement('span', { style: { fontSize: 12, width: 36, textAlign: 'right', color: 'var(--dsw-alias-label-secondary)' } }, angle + '°'),
        ),
        React.createElement('div', { style: { height: 36, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', background: cssGradient, boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.12)' } }),
        React.createElement('button', {
          onClick: function () { set({ wallpaper: { type: 'gradient', url: cssGradient, name: '自定义渐变 ' + angle + '°' } }) },
          style: { padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--dsw-alias-brand-primary)', color: '#ffffff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start' },
        }, isGradient ? '更新渐变' : '应用渐变'),
      )
    }

    // 壁纸区:上传磁贴 + 缩略图 + 滑杆
    function MediaEditor() {
      const state = useStore()
      const set = function (patch) { store.setState(patch) }
      const onPick = function (type) {
        return function (e) {
          const input = e.target
          const file = input.files && input.files[0]
          if (!file) return
          const url = URL.createObjectURL(file)
          set({ wallpaper: { type: type, url: url, name: file.name } })
          input.value = ''
        }
      }
      const uploadTile = function (title, hint, icon, accept, type) {
        return React.createElement('label', { 'data-upload-tile': '', style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px', borderRadius: 10, border: '1px dashed var(--dsw-alias-border-l2)', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' } },
          React.createElement('span', { style: { fontSize: 18, lineHeight: 1 } }, icon),
          React.createElement('span', { style: { fontSize: 13, color: 'var(--dsw-alias-label-primary)' } }, title),
          React.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' } }, hint),
          React.createElement('input', { type: 'file', accept: accept, style: { display: 'none' }, onChange: onPick(type) }),
        )
      }
      const slider = function (labelText, min, max, step, value, onChange) {
        return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { fontSize: 12, width: 48, color: 'var(--dsw-alias-label-secondary)' } }, labelText),
          React.createElement('input', { type: 'range', min: min, max: max, step: step, value: value, onChange: onChange, style: { flex: 1 } }),
          React.createElement('span', { style: { fontSize: 12, width: 36, textAlign: 'right', color: 'var(--dsw-alias-label-secondary)' } }, Math.round(value * 100) + '%'),
        )
      }
      const w = state.wallpaper && state.wallpaper.type !== 'gradient' ? state.wallpaper : null
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          uploadTile('上传图片', 'JPG / PNG / WebP', '🖼️', 'image/*', 'image'),
          uploadTile('上传视频', 'MP4 / WebM', '🎬', 'video/*', 'video'),
        ),
        w ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          w.type === 'image'
            ? React.createElement('img', { src: w.url, style: { width: 84, height: 50, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1)' } })
            : React.createElement('video', { src: w.url, muted: true, playsInline: true, style: { width: 84, height: 50, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1)' } }),
          React.createElement('div', { style: { flex: 1, minWidth: 0, fontSize: 12, color: 'var(--dsw-alias-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, w.name),
          React.createElement('button', {
            onClick: function () { set({ wallpaper: null }) },
            style: { padding: '6px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-state-error-primary)', fontFamily: 'inherit', fontSize: 12 },
          }, '移除'),
        ) : null,
        state.wallpaper ? slider('透明度', 0.4, 1, 0.05, state.opacity, function (e) { set({ opacity: parseFloat(e.target.value) }) }) : null,
        state.wallpaper ? slider('暗化', 0, 0.6, 0.05, state.dim, function (e) { set({ dim: parseFloat(e.target.value) }) }) : null,
      )
    }

    // 背景:渐变 + 壁纸
    function BackgroundSection() {
      return React.createElement(Card, null,
        React.createElement(CardTitle, null, '背景'),
        React.createElement(GradientEditor, null),
        React.createElement('div', { style: { height: 1, background: 'var(--dsw-alias-border-l1)' } }),
        React.createElement(MediaEditor, null),
      )
    }

    // 设置页根
    function WallpaperPage() {
      return React.createElement('div', { 'data-dsh-appearance': '', style: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 440 } },
        React.createElement(PaletteSection, null),
        React.createElement(BackgroundSection, null),
        React.createElement(GlassSection, null),
        React.createElement(Hint, null, '背景与渐变仅当前会话生效,刷新后需重新设置;配色与对话框设置即时生效。'),
      )
    }

    // 解析已应用渐变,用于编辑器回显
    function parseGradient(url) {
      const m = String(url).match(/^linear-gradient\((\d+)deg, rgb\((\d+),\s*(\d+),\s*(\d+)\), rgb\((\d+),\s*(\d+),\s*(\d+)\)\)$/)
      if (!m) return null
      return {
        angle: parseInt(m[1], 10),
        c1: { r: parseInt(m[2], 10), g: parseInt(m[3], 10), b: parseInt(m[4], 10) },
        c2: { r: parseInt(m[5], 10), g: parseInt(m[6], 10), b: parseInt(m[7], 10) },
      }
    }

    // ---- 插槽注册 ----
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'appearance', order: 5, label: function () { return '外观' } },
        function () { return React.createElement(WallpaperPage, null) },
      )
    })
    slots.inject('shell.overlay', function () {
      return slots.register(
        { name: 'shell.overlay', id: 'dsh-wallpaper' },
        function () { return React.createElement(WallpaperLayer, null) },
      )
    })
  },
}

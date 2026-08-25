import { useState, type FormEvent } from 'react'
import { updateAdminSettings, uploadAdminAsset } from '../../../api/admin'
import { Field, SettingsPage } from './SettingsPage'
import { useSettingsContext } from './SettingsContext'

export default function AppearanceSettings() {
  const { settings, reload } = useSettingsContext()
  const [logoLight, setLogoLight] = useState(settings.logo_light ?? '')
  const [logoDark, setLogoDark] = useState(settings.logo_dark ?? '')
  const [favicon, setFavicon] = useState(settings.favicon ?? '')
  const [theme, setTheme] = useState(settings.theme ?? 'light')
  const [customCss, setCustomCss] = useState(settings.custom_css ?? '')

  async function handleUpload(file: File, setter: (url: string) => void) {
    const url = await uploadAdminAsset(file)
    setter(url)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await updateAdminSettings({
      logo_light: logoLight || null,
      logo_dark: logoDark || null,
      favicon: favicon || null,
      theme,
      custom_css: customCss || null,
    })
    reload()
  }

  return (
    <SettingsPage title="Appearance" onSubmit={handleSubmit}>
      <div className="drawer-two-col">
        <Field label="Logo (Light)">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0], setLogoLight)} />
          {logoLight && <img src={logoLight} alt="Light logo" className="settings-preview" />}
        </Field>
        <Field label="Logo (Dark)">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0], setLogoDark)} />
          {logoDark && <img src={logoDark} alt="Dark logo" className="settings-preview" />}
        </Field>
      </div>
      <Field label="Favicon">
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0], setFavicon)} />
        {favicon && <img src={favicon} alt="Favicon" className="settings-preview settings-preview-sm" />}
      </Field>
      <Field label="Theme">
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Field>
      <Field label="Custom CSS">
        <textarea rows={4} value={customCss} onChange={(e) => setCustomCss(e.target.value)} placeholder='@import url("...");' />
      </Field>
    </SettingsPage>
  )
}

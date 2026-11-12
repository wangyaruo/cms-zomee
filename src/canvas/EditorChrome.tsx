'use client'

import { AutoField, Puck, usePuck } from '@measured/puck'
import type { ArrayField, FieldProps } from '@measured/puck'
import { copy } from '../i18n/shared'
import { useInterfaceLanguage } from '../components/InterfaceLanguageProvider'

export function LocalizedArrayField({ field, value = [], onChange, readOnly, id }: FieldProps<ArrayField>) {
  const language = useInterfaceLanguage()
  const t = (en: string, zh: string) => copy(language, en, zh)
  const rows = value as Record<string, unknown>[]
  const move = (index: number, offset: number) => {
    const next = [...rows]
    ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
    onChange(next)
  }
  const add = () => {
    const item = field.defaultItemProps || Object.fromEntries(Object.entries(field.arrayFields).map(([key, child]) => [key, child.type === 'number' ? child.min || 0 : child.type === 'array' ? [] : child.type === 'select' ? child.options[0]?.value : '']))
    onChange([...rows, { ...item }])
  }
  return <div className="canvas-array">
    {rows.map((row, index) => <fieldset key={index}>
      <legend>{field.getItemSummary?.(row, index) || `${t('Item', '条目')} ${index + 1}`}</legend>
      {Object.entries(field.arrayFields).map(([key, child]) => <div key={key} className="canvas-array-field">
        <label htmlFor={`${id}-${index}-${key}`}>{child.label || key}</label>
        <AutoField field={child} id={`${id}-${index}-${key}`} readOnly={readOnly} value={row[key]} onChange={(next) => onChange(rows.map((item, at) => at === index ? { ...item, [key]: next } : item))} />
      </div>)}
      <div className="canvas-inline-actions">
        <button type="button" disabled={readOnly || index === 0} onClick={() => move(index, -1)}>{t('Move up', '上移')}</button>
        <button type="button" disabled={readOnly || index === rows.length - 1} onClick={() => move(index, 1)}>{t('Move down', '下移')}</button>
        <button type="button" disabled={readOnly || rows.length <= (field.min || 0)} onClick={() => onChange(rows.filter((_, at) => at !== index))}>{t('Remove item', '移除条目')}</button>
      </div>
    </fieldset>)}
    <button type="button" disabled={readOnly || (field.max !== undefined && rows.length >= field.max)} onClick={add}>{t('Add item', '添加条目')}</button>
  </div>
}

export default function EditorChrome() {
  const language = useInterfaceLanguage()
  const t = (en: string, zh: string) => copy(language, en, zh)
  const { appState, config, dispatch, selectedItem, getSelectorForId, history } = usePuck()
  const selector = selectedItem ? getSelectorForId(selectedItem.props.id) : undefined
  const viewport = appState.ui.viewports.current.width
  const setViewport = (width: number) => dispatch({ type: 'setUi', ui: { viewports: { ...appState.ui.viewports, current: { width, height: 'auto' } } } })
  return <div className="canvas-panels">
    <aside className="canvas-block-panel" aria-label={t('Page blocks', '页面区块')}>
      <h2>{t('Blocks', '区块')}</h2><Puck.Components />
      <h2>{t('Outline', '页面结构')}</h2>
      {appState.data.content.length ? <Puck.Outline /> : <p>{t('No blocks yet. Drag a block onto the page.', '还没有区块，请从上方拖入页面。')}</p>}
    </aside>
    <section className="canvas-stage" aria-label={t('Page preview', '页面预览')}>
      <div className="canvas-inline-actions canvas-preview-controls">
        <button type="button" disabled={!history.hasPast} onClick={() => history.back()}>{t('Undo', '撤销')}</button>
        <button type="button" disabled={!history.hasFuture} onClick={() => history.forward()}>{t('Redo', '重做')}</button>
        <button type="button" aria-pressed={viewport !== 390} onClick={() => setViewport(1440)}>{t('Desktop', '桌面')}</button>
        <button type="button" aria-pressed={viewport === 390} onClick={() => setViewport(390)}>{t('Mobile', '手机')}</button>
      </div>
      <div className="canvas-preview-frame"><Puck.Preview /></div>
    </section>
    <aside className="canvas-field-panel" aria-label={t('Block properties', '区块属性')}>
      <h2>{selectedItem ? config.components[selectedItem.type]?.label : t('Block properties', '区块属性')}</h2>
      {selectedItem ? <><Puck.Fields />{selector && <div className="canvas-inline-actions">
        <button type="button" onClick={() => dispatch({ type: 'duplicate', sourceIndex: selector.index, sourceZone: selector.zone })}>{t('Duplicate block', '复制区块')}</button>
        <button type="button" onClick={() => dispatch({ type: 'remove', index: selector.index, zone: selector.zone })}>{t('Remove block', '移除区块')}</button>
      </div>}</> : <p>{t('Select a block on the page to edit its properties.', '请选择页面中的区块，再编辑它的属性。')}</p>}
    </aside>
  </div>
}

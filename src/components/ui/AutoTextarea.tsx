import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Altura máxima (px). Acima dela o campo rola por dentro. Sem limite = cresce com o texto. */
  maxHeight?: number
}

/**
 * Textarea que cresce com o conteúdo — inclusive com a QUEBRA AUTOMÁTICA de linha. Antes, os campos
 * calculavam `rows` só pelos "\n" digitados: num texto longo sem Enter, numa tela estreita (Android),
 * a quebra visual excedia a altura e o resto ficava escondido (`overflow-hidden`).
 * Reajusta ao montar, a cada mudança de valor/digitação e quando a LARGURA muda (rotação, teclado,
 * janela redimensionada no Windows, painel que aparece). Funciona com `value` ou `defaultValue`.
 */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoTextarea(
  { maxHeight, onInput, rows = 1, style, ...rest },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null)
  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      inner.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )

  const fit = useCallback(() => {
    const el = inner.current
    // Invisível (display:none / aba escondida): medir daria 0 — espera ficar visível (o observer avisa).
    if (!el || el.clientWidth === 0) return
    el.style.height = 'auto'
    // border-box: scrollHeight já inclui o padding; soma só as bordas.
    const cs = getComputedStyle(el)
    const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    const full = el.scrollHeight + borders
    if (maxHeight && full > maxHeight) {
      el.style.height = `${maxHeight}px`
      el.style.overflowY = 'auto'
    } else {
      el.style.height = `${full}px`
      el.style.overflowY = 'hidden'
    }
  }, [maxHeight])

  // Valor controlado mudou (ou primeira montagem).
  useLayoutEffect(fit, [fit, rest.value])

  // Largura mudou → a quebra de linha muda → reajusta. (Só largura: a altura é nossa.)
  useEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastW = el.clientWidth
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w !== lastW) {
        lastW = w
        fit()
      }
    })
    ro.observe(el)
    // Fontes web (Inter) carregando depois mudam a métrica do texto.
    void document.fonts?.ready.then(fit)
    return () => ro.disconnect()
  }, [fit])

  return (
    <textarea
      ref={setRefs}
      rows={rows}
      style={style}
      onInput={(e) => {
        fit()
        onInput?.(e)
      }}
      {...rest}
    />
  )
})

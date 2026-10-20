export { cn } from "cn"

export function greekCaps(text: string) {
  return text.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC")
}

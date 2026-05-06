import { describe, expect, it } from "vitest"
import { defaultQuestionBody, defaultQuestionTitle } from "./questionDefaults.js"

describe("question defaults", () => {
  it("uses source question text when present and generic copy when blank", () => {
    expect(defaultQuestionTitle("  育児休業   申請期限 ".repeat(4))).toContain("について確認したい")
    expect(defaultQuestionTitle("   ")).toBe("資料外の内容について確認したい")
    expect(defaultQuestionBody("申請期限は？")).toContain("申請期限は？")
    expect(defaultQuestionBody("   ")).toBe("資料を確認しましたが、該当する情報が見つかりませんでした。ご教示いただけますでしょうか。")
  })
})

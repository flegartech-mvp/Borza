// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { OptionList } from "./quiz-page";

afterEach(cleanup);

const options = [
  { id: "a", text: { de: "Option A", sl: "Možnost A", en: "Option A" } },
  { id: "b", text: { de: "Option B", sl: "Možnost B", en: "Option B" } },
];

function TwoQuestions() {
  const [first, setFirst] = useState<string[]>([]);
  const [second, setSecond] = useState<string[]>([]);
  return (
    <>
      <OptionList
        groupName="question-one"
        options={options}
        selected={first}
        multiple={false}
        disabled={false}
        language="en"
        onChange={setFirst}
      />
      <OptionList
        groupName="question-two"
        options={options}
        selected={second}
        multiple={false}
        disabled={false}
        language="en"
        onChange={setSecond}
      />
    </>
  );
}

describe("quiz controls", () => {
  it("keeps repeated option IDs in separate radio groups", async () => {
    const user = userEvent.setup();
    render(<TwoQuestions />);
    const choices = screen.getAllByRole("radio", { name: "Option A" });
    await user.click(choices[0]);
    await user.click(choices[1]);
    expect(choices[0]).toBeChecked();
    expect(choices[1]).toBeChecked();
    expect(choices[0]).toHaveAttribute("name", "question-one");
    expect(choices[1]).toHaveAttribute("name", "question-two");
  });
});

import { useCallback, useEffect, useState } from "react";

/**
 * 表单/JSON 模式切换逻辑的自定义 Hook
 *
 * @description 封装表单模式和 JSON 模式之间的切换逻辑，包括数据同步和状态管理。
 */
export function useInputModeSync(
  form: any,
  defaultValues: any,
  toolInputSchema: any
) {
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [jsonInput, setJsonInput] = useState<string>("{\n  \n}");

  // 当工具变化时重置 JSON 输入
  useEffect(() => {
    if (toolInputSchema) {
      try {
        setJsonInput(JSON.stringify(defaultValues, null, 2));
      } catch {
        setJsonInput("{\n  \n}");
      }
    } else {
      setJsonInput("{\n  \n}");
    }
  }, [toolInputSchema, defaultValues]);

  const handleModeChange = useCallback(
    (newMode: "form" | "json") => {
      if (newMode === "json" && inputMode === "form") {
        // 从表单模式切换到 JSON 模式时，同步数据
        const currentValues = form.getValues();
        try {
          setJsonInput(JSON.stringify(currentValues, null, 2));
        } catch {
          setJsonInput("{\n  \n}");
        }
      } else if (newMode === "form" && inputMode === "json") {
        // 从 JSON 模式切换到表单模式时，同步数据
        try {
          const parsedData = JSON.parse(jsonInput);
          // 使用 setValue 而不是 reset 来避免表单重新初始化导致的失焦
          for (const key of Object.keys(parsedData)) {
            form.setValue(key as any, parsedData[key]);
          }
        } catch {
          // JSON 解析失败，保持表单数据不变
        }
      }
      setInputMode(newMode);
    },
    [inputMode, jsonInput, form]
  );

  return {
    inputMode,
    jsonInput,
    setJsonInput,
    handleModeChange,
    setInputMode,
  };
}

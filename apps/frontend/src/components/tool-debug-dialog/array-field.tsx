/**
 * 数组字段渲染器组件
 *
 * @description 用于渲染数组类型的 JSON Schema 字段。
 * 该组件针对工具调试场景进行了优化，支持嵌套对象和数组。
 */

import { Button } from "@/components/ui/button";
import { FormField, FormItem } from "@/components/ui/form";
import { Plus, Trash2 } from "lucide-react";
import { memo } from "react";
import { useFieldArray } from "react-hook-form";
import type { ArrayFieldProps } from "./types";

/**
 * 数组字段渲染器组件
 *
 * @param props - 组件属性
 * @param props.name - 字段名称
 * @param props.schema - JSON Schema 定义
 * @param props.form - react-hook-form 表单实例
 * @param props.renderFormField - 渲染单个字段的函数
 */
export const ArrayField = memo(function ArrayField({
  name,
  schema,
  form,
  renderFormField,
}: ArrayFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: name as any,
  });

  const addItem = () => {
    const itemSchema = schema.items;
    let newItem: any;

    switch (itemSchema.type) {
      case "string":
        newItem = itemSchema.enum ? itemSchema.enum[0] : "";
        break;
      case "number":
      case "integer":
        newItem = 0;
        break;
      case "boolean":
        newItem = false;
        break;
      case "array":
        newItem = [];
        break;
      case "object":
        newItem = {};
        break;
      default:
        newItem = "";
    }

    append(newItem);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          数组项目 ({schema.items?.type || "unknown"})
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="h-8 px-2"
        >
          <Plus className="h-3 w-3 mr-1" />
          添加
        </Button>
      </div>
      {fields.length === 0 ? (
        <div className="text-center py-4 border border-dashed rounded-md">
          <span className="text-sm text-muted-foreground">暂无数组项目</span>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="relative p-3 border rounded-md bg-muted/20"
            >
              <div className="absolute top-2 right-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="pr-8">
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  项目 {index + 1}
                </span>
                <FormField
                  control={form.control}
                  name={`${name}.${index}` as any}
                  render={() => (
                    <FormItem>
                      {(() => {
                        if (
                          schema.items?.type === "object" ||
                          schema.items?.type === "array"
                        ) {
                          return (
                            <div className="ml-6 border-l-2 border-muted pl-4">
                              {renderFormField(
                                `${name}.${index}`,
                                schema.items
                              )}
                            </div>
                          );
                        }
                        return renderFormField(
                          `${name}.${index}`,
                          schema.items
                        );
                      })()}
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
/**
 * 无参数提示组件
 *
 * @description 用于显示无需输入参数的提示信息。
 * 当工具没有输入参数定义时显示此组件。
 */

import { CheckIcon } from "lucide-react";
import { memo } from "react";

/**
 * 无参数提示组件
 *
 * 显示一个居中的提示信息，告知用户该工具无需输入参数，
 * 可以直接点击"调用工具"按钮执行。
 */
export const NoParamsMessage = memo(function NoParamsMessage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm mx-auto p-6">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckIcon className="h-8 w-8 text-green-600" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            无需输入参数
          </h3>
          <p className="text-sm text-muted-foreground">
            点击"调用工具"按钮执行，无需输入任何参数。
          </p>
        </div>
      </div>
    </div>
  );
});
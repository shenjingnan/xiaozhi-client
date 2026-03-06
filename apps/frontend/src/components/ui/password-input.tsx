import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordInputProps
  extends React.ComponentPropsWithoutRef<typeof Input> {
  /** 是否显示密码 */
  showPassword?: boolean;
  /** 显示密码变更回调 */
  onShowPasswordChange?: (show: boolean) => void;
}

/**
 * 密码输入框组件
 *
 * 支持明文/密文切换，通过眼睛图标控制显示状态。
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showPassword, onShowPasswordChange, ...props }, ref) => {
    const [internalShow, setInternalShow] = React.useState(false);
    const isControlled = showPassword !== undefined;
    const isShow = isControlled ? showPassword : internalShow;

    const handleToggle = () => {
      if (isControlled && onShowPasswordChange) {
        onShowPasswordChange(!showPassword);
      } else {
        setInternalShow(!internalShow);
      }
    };

    return (
      <div className="relative">
        <Input
          type={isShow ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={handleToggle}
          tabIndex={-1}
        >
          {isShow ? (
            <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          )}
          <span className="sr-only">{isShow ? "隐藏密码" : "显示密码"}</span>
        </Button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };

import * as React from "react";

import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

// 上下文类型定义
interface TableSizeContextValue {
  size: "default" | "compact";
}

const TableSizeContext = React.createContext<TableSizeContextValue>({
  size: "default",
});

// Table 组件变体样式
const tableVariants = cva("w-full caption-bottom text-sm", {
  variants: {
    size: {
      default: "text-sm",
      compact: "text-xs",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

// TableHead 组件变体样式
const tableHeadVariants = cva(
  "text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
  {
    variants: {
      size: {
        default: "h-12 px-4",
        compact: "h-10 p-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

// TableCell 组件变体样式
const tableCellVariants = cva("align-middle [&:has([role=checkbox])]:pr-0", {
  variants: {
    size: {
      default: "p-4",
      compact: "py-2 px-4",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

// 类型导出
export type TableProps = React.HTMLAttributes<HTMLTableElement> &
  VariantProps<typeof tableVariants>;

export type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement>;

export type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, size, children, ...props }, ref) => {
    const tableSize = size ?? "default";
    return (
      <TableSizeContext.Provider value={{ size: tableSize }}>
        <div className="relative w-full overflow-auto">
          <table
            ref={ref}
            className={cn(tableVariants({ size: tableSize, className }))}
            {...props}
          >
            {children}
          </table>
        </div>
      </TableSizeContext.Provider>
    );
  }
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, ...props }, ref) => {
    const { size } = React.useContext(TableSizeContext);
    return (
      <th
        ref={ref}
        className={cn(tableHeadVariants({ size, className }))}
        {...props}
      />
    );
  }
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => {
    const { size } = React.useContext(TableSizeContext);
    return (
      <td
        ref={ref}
        className={cn(tableCellVariants({ size, className }))}
        {...props}
      />
    );
  }
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};

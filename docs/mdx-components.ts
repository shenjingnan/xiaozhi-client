import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

const themeComponents = getThemeComponents();

export function useMDXComponents(components: Record<string, React.ComponentType<unknown>>) {
  return {
    ...themeComponents,
    ...components,
  };
}

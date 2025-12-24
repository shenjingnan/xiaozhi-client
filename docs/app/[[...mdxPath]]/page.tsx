import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents as getMDXComponents } from "../../mdx-components";

// 只在生产环境生成静态参数
export const generateStaticParams =
  process.env.NODE_ENV === "production" ? generateStaticParamsFor("mdxPath") : () => [];

export async function generateMetadata({
  params
}: {
  params: Promise<{ mdxPath?: string[] }>
}): Promise<Metadata> {
  const resolvedParams = await params;

  // 如果 mdxPath 不存在或者是数组且为空，返回首页 metadata
  if (!resolvedParams.mdxPath || resolvedParams.mdxPath.length === 0) {
    try {
      const { metadata } = await importPage([]);
      return metadata;
    } catch (_error) {
      return {};
    }
  }

  // 如果 mdxPath 是数组，保持为数组格式传递给 importPage
  try {
    const { metadata } = await importPage(resolvedParams.mdxPath);
    return metadata;
  } catch (_error) {
    return {};
  }
}

const Wrapper = getMDXComponents({}).wrapper;

export default async function Page({
  params
}: {
  params: Promise<{ mdxPath?: string[] }>
}) {
  const resolvedParams = await params;

  // 如果 mdxPath 不存在或者是数组且为空，返回首页
  if (!resolvedParams.mdxPath || resolvedParams.mdxPath.length === 0) {
    try {
      const { default: MDXContent, toc, metadata, sourceCode } = await importPage([]);
      return (
        <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
          <MDXContent params={resolvedParams} />
        </Wrapper>
      );
    } catch (_error) {
      return notFound();
    }
  }

  // 如果 mdxPath 是数组，保持为数组格式传递给 importPage
  try {
    const { default: MDXContent, toc, metadata, sourceCode } = await importPage(resolvedParams.mdxPath);
    return (
      <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
        <MDXContent params={resolvedParams} />
      </Wrapper>
    );
  } catch (_error) {
    return notFound();
  }
}

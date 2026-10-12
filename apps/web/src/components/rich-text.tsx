import { Fragment } from "react"
import { parseRichText, type Inline } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "text") return <Fragment key={index}>{node.text}</Fragment>
        if (node.type === "strong") return <strong key={index} className="font-semibold"><InlineNodes nodes={node.children} /></strong>
        if (node.type === "em") return <em key={index}><InlineNodes nodes={node.children} /></em>
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-words text-primary underline underline-offset-2 hover:text-primary/80">
            <InlineNodes nodes={node.children} />
          </a>
        )
      })}
    </>
  )
}

/** Renders an event description (EVT-03 Markdown subset) as React elements only. */
export function RichText({ source, className }: { source: string | null | undefined; className?: string }) {
  const blocks = parseRichText(source)
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {blocks.map((block, index) => {
        if (block.type === "p") {
          return (
            <p key={index} className="break-words">
              {block.lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>{lineIndex > 0 && <br />}<InlineNodes nodes={line} /></Fragment>
              ))}
            </p>
          )
        }
        const List = block.type === "ul" ? "ul" : "ol"
        return (
          <List key={index} className={cn("flex flex-col gap-1 pl-5", block.type === "ul" ? "list-disc" : "list-decimal")}>
            {block.items.map((item, itemIndex) => <li key={itemIndex} className="break-words"><InlineNodes nodes={item} /></li>)}
          </List>
        )
      })}
    </div>
  )
}

import { courseKeys } from '../i18n/course-keys'
import { formatInline, tr } from '../app/helpers'
import type { CourseItem } from '../app/types'

type ItemListProps = {
  items: CourseItem[]
  acronymMap: Map<string, string>
  sectionId: string
  subsectionId: string
  topicId: string
  parentItemId?: string
  t: (key: string) => string
}

export function ItemList({
  items,
  acronymMap,
  sectionId,
  subsectionId,
  topicId,
  parentItemId,
  t,
}: ItemListProps) {
  return (
    <ul className="itemList">
      {items.map((item) => {
        const label = parentItemId
          ? tr(t, courseKeys.subItemName(sectionId, subsectionId, topicId, parentItemId, item.id), item.name ?? item.title ?? item.id)
          : tr(t, courseKeys.itemName(sectionId, subsectionId, topicId, item.id), item.name ?? item.title ?? item.id)

        const description = item.description
          ? parentItemId
            ? formatInline(tr(t, courseKeys.subItemDescription(sectionId, subsectionId, topicId, parentItemId, item.id), item.description), acronymMap)
            : formatInline(tr(t, courseKeys.itemDescription(sectionId, subsectionId, topicId, item.id), item.description), acronymMap)
          : null

        const content = item.content
          ? formatInline(tr(t, courseKeys.itemContent(sectionId, subsectionId, topicId, item.id), item.content), acronymMap)
          : null

        return (
          <li key={item.id} className="itemCard">
            <div className="itemHeader">
              <div className="itemTitle">{label}</div>
              {item.id ? <div className="pill">{item.id}</div> : null}
            </div>
            {description ? <p className="muted">{description}</p> : null}
            {content ? <p>{content}</p> : null}
            {item.examples?.length ? (
              <div className="chips">
                {item.examples.map((example, idx) => (
                  <span key={idx} className="chip">
                    {formatInline(tr(t, courseKeys.itemExample(sectionId, subsectionId, topicId, item.id, idx), example), acronymMap)}
                  </span>
                ))}
              </div>
            ) : null}
            {item.items?.length ? (
              <ItemList
                items={item.items}
                acronymMap={acronymMap}
                sectionId={sectionId}
                subsectionId={subsectionId}
                topicId={topicId}
                parentItemId={item.id}
                t={t}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

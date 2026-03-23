import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
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

type ItemCardProps = Omit<ItemListProps, 'items'> & {
  item: CourseItem
  index: number
}

function ItemCard({
  item,
  index,
  acronymMap,
  sectionId,
  subsectionId,
  topicId,
  parentItemId,
  t,
}: ItemCardProps) {
  const [open, setOpen] = useState(index === 0)

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

  const hasDetails = Boolean(description || content || item.examples?.length || item.items?.length)

  return (
    <motion.li
      className={['itemCard', open ? 'open' : ''].join(' ')}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      transition={{ duration: 0.28, delay: index * 0.04 }}
      layout
    >
      <button
        type="button"
        className="itemHeader itemToggle"
        onClick={() => {
          if (!hasDetails) return
          setOpen((current) => !current)
        }}
      >
        <div className="itemHeaderMain">
          <div className="itemTitle">{label}</div>
          {description ? <p className="muted itemPreview">{description}</p> : null}
        </div>
        <div className="itemHeaderAside">
          {item.id ? <div className="pill">{item.id}</div> : null}
          {hasDetails ? (
            <motion.span className="itemChevron" animate={{ rotate: open ? 180 : 0 }}>
              ⌄
            </motion.span>
          ) : null}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && hasDetails ? (
          <motion.div
            className="itemBody"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.li>
  )
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
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          index={index}
          acronymMap={acronymMap}
          sectionId={sectionId}
          subsectionId={subsectionId}
          topicId={topicId}
          parentItemId={parentItemId}
          t={t}
        />
      ))}
    </ul>
  )
}

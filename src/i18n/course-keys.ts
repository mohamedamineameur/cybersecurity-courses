/**
 * Helpers pour générer les clés Tolgee du cours.
 * Doit correspondre exactement au format produit par scripts/tolgee-import.mjs
 */

export function sanitizeId(id: string): string {
  return String(id).replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function courseKey(
  sectionId: string,
  subsectionId?: string,
  topicId?: string,
  path?: string
): string {
  const sId = sanitizeId(sectionId)
  let key = `course.section.${sId}`
  if (!subsectionId) return `${key}.title`
  const ssId = sanitizeId(subsectionId)
  key += `.subsection.${ssId}`
  if (!topicId) return `${key}.title`
  const tId = sanitizeId(topicId)
  key += `.topic.${tId}`
  if (!path) return key
  return `${key}.${path}`
}

export const courseKeys = {
  sectionTitle: (sectionId: string) => `course.section.${sanitizeId(sectionId)}.title`,
  subsectionTitle: (sectionId: string, subsectionId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.title`,
  topicTitle: (sectionId: string, subsectionId: string, topicId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.title`,
  topicContent: (sectionId: string, subsectionId: string, topicId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.content`,
  itemName: (sectionId: string, subsectionId: string, topicId: string, itemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.item.${sanitizeId(itemId)}.name`,
  itemTitle: (sectionId: string, subsectionId: string, topicId: string, itemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.item.${sanitizeId(itemId)}.title`,
  itemDescription: (sectionId: string, subsectionId: string, topicId: string, itemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.item.${sanitizeId(itemId)}.description`,
  itemContent: (sectionId: string, subsectionId: string, topicId: string, itemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.item.${sanitizeId(itemId)}.content`,
  itemExample: (sectionId: string, subsectionId: string, topicId: string, itemId: string, idx: number) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.item.${sanitizeId(itemId)}.examples.${idx}`,
  subItemName: (sectionId: string, subsectionId: string, topicId: string, itemId: string, subItemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.item.${sanitizeId(itemId)}.item.${sanitizeId(subItemId)}.name`,
  subItemTitle: (sectionId: string, subsectionId: string, topicId: string, itemId: string, subItemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.item.${sanitizeId(itemId)}.item.${sanitizeId(subItemId)}.title`,
  subItemDescription: (sectionId: string, subsectionId: string, topicId: string, itemId: string, subItemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.item.${sanitizeId(itemId)}.item.${sanitizeId(subItemId)}.description`,
  subtopicTitle: (sectionId: string, subsectionId: string, topicId: string, subtopicId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.subtopic.${sanitizeId(subtopicId)}.title`,
  subtopicItemName: (sectionId: string, subsectionId: string, topicId: string, subtopicId: string, itemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.subtopic.${sanitizeId(subtopicId)}.item.${sanitizeId(itemId)}.name`,
  subtopicItemDescription: (sectionId: string, subsectionId: string, topicId: string, subtopicId: string, itemId: string) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.subtopic.${sanitizeId(subtopicId)}.item.${sanitizeId(itemId)}.description`,
  quizQuestion: (sectionId: string, subsectionId: string, topicId: string, quizIdx: number) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.quiz.${quizIdx}.question`,
  quizCorrectAnswer: (sectionId: string, subsectionId: string, topicId: string, quizIdx: number) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.quiz.${quizIdx}.correctAnswer`,
  quizExplanation: (sectionId: string, subsectionId: string, topicId: string, quizIdx: number) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.quiz.${quizIdx}.explanation`,
  quizChoice: (sectionId: string, subsectionId: string, topicId: string, quizIdx: number, choiceIdx: number) =>
    `course.section.${sanitizeId(sectionId)}.subsection.${sanitizeId(subsectionId)}.topic.${sanitizeId(topicId)}.quiz.${quizIdx}.choices.${choiceIdx}`,
}

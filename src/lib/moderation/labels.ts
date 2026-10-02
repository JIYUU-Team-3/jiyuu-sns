import { m } from '#lib/paraglide/messages.js'
import type { Rule } from './rules'

const LABELS: Record<Rule, () => string> = {
	child_safety: m.rule_child_safety,
	threat: m.rule_threat,
	terrorism: m.rule_terrorism,
	intimate_media: m.rule_intimate_media,
	doxxing: m.rule_doxxing,
	self_harm_encouragement: m.rule_self_harm_encouragement,
	hate: m.rule_hate,
	harassment: m.rule_harassment,
	impersonation: m.rule_impersonation,
	spam: m.rule_spam,
	scam: m.rule_scam,
	malicious_link: m.rule_malicious_link,
	illegal_goods: m.rule_illegal_goods,
	sexual: m.rule_sexual,
	gore: m.rule_gore,
	copyright: m.rule_copyright,
}

const DESCRIPTIONS: Record<Rule, () => string> = {
	child_safety: m.rule_child_safety_desc,
	threat: m.rule_threat_desc,
	terrorism: m.rule_terrorism_desc,
	intimate_media: m.rule_intimate_media_desc,
	doxxing: m.rule_doxxing_desc,
	self_harm_encouragement: m.rule_self_harm_encouragement_desc,
	hate: m.rule_hate_desc,
	harassment: m.rule_harassment_desc,
	impersonation: m.rule_impersonation_desc,
	spam: m.rule_spam_desc,
	scam: m.rule_scam_desc,
	malicious_link: m.rule_malicious_link_desc,
	illegal_goods: m.rule_illegal_goods_desc,
	sexual: m.rule_sexual_desc,
	gore: m.rule_gore_desc,
	copyright: m.rule_copyright_desc,
}

/** A rule's short name, e.g. "Hate speech". */
export const rule_label = (rule: Rule) => LABELS[rule]()

/** What the rule covers, in a sentence. */
export const rule_description = (rule: Rule) => DESCRIPTIONS[rule]()

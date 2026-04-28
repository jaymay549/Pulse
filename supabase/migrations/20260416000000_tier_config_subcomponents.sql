-- Allow sub-component keys (dot notation) in tier_component_config
ALTER TABLE tier_component_config DROP CONSTRAINT tier_component_config_component_key_check;
ALTER TABLE tier_component_config ADD CONSTRAINT tier_component_config_component_key_check
CHECK (component_key ~ '^(intelligence|overview|segments|mentions|profile|intel|dimensions|demo-requests|screenshots|categories|dealer-signals)(\.[a-z_]+)?$');

-- Seed sub-component rows with 'full' default for all tiers
INSERT INTO tier_component_config (tier, component_key, visibility)
SELECT t.tier, sc.key, 'full'
FROM (VALUES ('tier_1'), ('tier_2'), ('test')) AS t(tier)
CROSS JOIN (VALUES
  ('intelligence.health_score'), ('intelligence.nps_chart'), ('intelligence.performance_metrics'),
  ('intelligence.benchmarking'), ('intelligence.recommended_actions'), ('intelligence.momentum'),
  ('overview.pulse_briefing'), ('overview.sentiment_trend'), ('overview.discussion_volume'),
  ('overview.nps'), ('overview.recent_activity'),
  ('segments.axis_summary'), ('segments.bucket_cards'),
  ('intel.your_position'), ('intel.competitor_table'),
  ('mentions.sentiment_card'), ('mentions.mention_cards'), ('mentions.respond'),
  ('dealer-signals.kpi_cards'), ('dealer-signals.status_breakdown'),
  ('dealer-signals.exit_reasons'), ('dealer-signals.market_share'),
  ('demo-requests.request_cards'), ('demo-requests.contact_info'),
  ('dimensions.radar_chart'), ('dimensions.bar_chart'), ('dimensions.dimension_cards'),
  ('screenshots.upload'), ('screenshots.gallery'),
  ('profile.banner_logo'), ('profile.details_form'), ('profile.screenshots')
) AS sc(key)
ON CONFLICT (tier, component_key) DO NOTHING;

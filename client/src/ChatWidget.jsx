import React from 'react';
import { OvoWidget } from './widget-sdk/OvoWidget';

export { OvoWidget, OvoWidgetClient, mountOvoWidget } from './widget-sdk';
export { VoraWidget, VoraWidgetClient, mountVoraWidget } from './widget-sdk';

export default function ChatWidget(props) {
  return <OvoWidget {...props} />;
}

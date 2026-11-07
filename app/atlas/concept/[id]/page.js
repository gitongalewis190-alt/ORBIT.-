'use client';

import AtlasScreen from '../../../../components/atlas/AtlasScreen';
import '../../atlas.css';

export default function ConceptPage({ params }) {
  return <AtlasScreen focusId={params.id} />;
}

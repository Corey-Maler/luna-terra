import { TerraMap } from '@lunaterra/terra';
import { DocPage } from '../../components/DocPage/DocPage';

export default function Terra() {
  return (
    <DocPage title="Terra" section="@lunaterra/terra">
      <DocPage.Section id="overview" title="Overview">
        <p>
          <code>@lunaterra/terra</code> is the OSM tile map renderer for Luna-Terra.
          It provides lazy quadtree tile fetching, coordinate unpacking, and
          geometry rendering on top of <code>@lunaterra/core</code>.
        </p>
        <p>
          The tile server must be running on <code>http://localhost:11111</code>.
          Start it with <code>./serve-tiles.sh</code> from the workspace root.
        </p>
      </DocPage.Section>

      <DocPage.Section id="map" title="Live Map">
        <div style={{ height: '60vh', display: 'flex', flex: '1 1 auto' }}>
          <TerraMap />
        </div>
      </DocPage.Section>
    </DocPage>
  );
}

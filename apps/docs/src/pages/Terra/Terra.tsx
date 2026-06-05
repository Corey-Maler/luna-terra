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
      </DocPage.Section>

      <DocPage.Section id="status" title="Status">
        <p>
          This package is under active development. The tile pipeline
          (Swift generator → JSON tiles → browser renderer) is being
          migrated from <code>legacy-fe</code> into this package.
        </p>
      </DocPage.Section>
    </DocPage>
  );
}

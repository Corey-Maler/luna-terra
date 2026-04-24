import { Route, Routes, Link, useLocation, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { RouteDefinitions } from './AllPages';

const Home = lazy(() => import('./Home/Home'));

const NotFound = () => {
    return <div>
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist.</p>
        <Link to="/">Go to Home</Link>
    </div>
}

const Page = () => {
    const location = useLocation();
    const route = location.pathname.slice(1).split('/');
    const sectionTag = route[0];
    const pageTag = route[1];

    const page = RouteDefinitions.find(section => section['tag'] === sectionTag)?.pages.find(page => page.tag === pageTag);
    if (page) {
        const Element = page.Element;
        return <div>
            <Element />
        </div>
    }
    
    return <NotFound />
}


export const RouterPage = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={null}>
            <Home />
          </Suspense>
        }
      />
      <Route path="*" element={<Page />} />
    </Routes>
  );
};

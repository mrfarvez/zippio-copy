import { Outlet } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';

export default function AppLayout() {
  return (
    <>
      <Nav />
      <main>
        <div className="wrap" style={{ paddingTop: 56, paddingBottom: 80 }}>
          <Outlet />
        </div>
      </main>
      <Footer />
    </>
  );
}

/**
 * Navbar 元件：包含 logo 與選單連結的頂部導覽列。
 * \"Explore\" 與 \"Discuss\" 連結是未來功能的 placeholder（目前停用）。
 */
import { type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: FC = () => {
    const location = useLocation();

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <Link to="/" className="navbar-logo">
                    JustCode_
                </Link>
                <ul className="navbar-menu">
                    <li>
                        <Link to="/problems" className={location.pathname.includes('/problems') ? 'active' : ''}>
                            Problems
                        </Link>
                    </li>
                    <li className="navbar-disabled-item">
                        <a href="#" className="navbar-link-disabled">
                            Explore
                        </a>
                    </li>
                    <li className="navbar-disabled-item">
                        <a href="#" className="navbar-link-disabled">
                            Discuss
                        </a>
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;

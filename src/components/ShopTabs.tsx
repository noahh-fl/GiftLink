import "./ShopTabs.css";

interface ShopTab {
  value: string;
  label: string;
}

interface ShopTabsProps {
  value: string;
  tabs: ShopTab[];
  onChange: (value: string) => void;
}

export default function ShopTabs({ value, tabs, onChange }: ShopTabsProps) {
  return (
    <div className="shop-tabs" role="radiogroup" aria-label="Gift shop view">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            className={active ? "shop-tabs__tab shop-tabs__tab--active" : "shop-tabs__tab"}
            onClick={() => onChange(tab.value)}
            aria-pressed={active}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

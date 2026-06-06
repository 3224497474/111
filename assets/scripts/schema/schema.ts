type ConfigLoader = (fileName: string) => unknown;

type TableRow = {
    id?: string | number;
    [key: string]: unknown;
};

class GenericTable<TRow extends TableRow> {
    private readonly rows: TRow[];
    private readonly rowMap = new Map<string, TRow>();

    public constructor(rows: unknown) {
        this.rows = Array.isArray(rows) ? (rows as TRow[]) : [];

        for (const row of this.rows) {
            const id = row?.id;
            if (id === undefined || id === null) {
                continue;
            }
            this.rowMap.set(String(id), row);
        }
    }

    public get(id: string | number): TRow | undefined {
        return this.rowMap.get(String(id));
    }

    public getDataList(): TRow[] {
        return [...this.rows];
    }
}

type SystemPromptRow = {
    id: string;
    title?: string;
    content?: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
};

function resolveConfig(loader: ConfigLoader, ...names: string[]): unknown[] {
    for (const name of names) {
        const data = loader(name);
        if (Array.isArray(data)) {
            return data;
        }
    }
    return [];
}

export class Tables {
    public readonly TbCharacter: GenericTable<TableRow>;
    public readonly TbMonster: GenericTable<TableRow>;
    public readonly TbSoul: GenericTable<TableRow>;
    public readonly TbSkill: GenericTable<TableRow>;
    public readonly TbRune: GenericTable<TableRow>;
    public readonly TbItem: GenericTable<TableRow>;
    public readonly TbSystemPrompt: GenericTable<SystemPromptRow>;

    public constructor(loader: ConfigLoader) {
        this.TbCharacter = new GenericTable(resolveConfig(loader, 'tbcharacter', 'TbCharacter'));
        this.TbMonster = new GenericTable(resolveConfig(loader, 'tbmonster', 'TbMonster'));
        this.TbSoul = new GenericTable(resolveConfig(loader, 'tbsoul', 'TbSoul'));
        this.TbSkill = new GenericTable(resolveConfig(loader, 'tbskill', 'TbSkill'));
        this.TbRune = new GenericTable(resolveConfig(loader, 'tbrune', 'TbRune'));
        this.TbItem = new GenericTable(resolveConfig(loader, 'demo_tbitem', 'TbItem'));
        this.TbSystemPrompt = new GenericTable(resolveConfig(loader, 'tbsystemprompt', 'TbSystemPrompt'));
    }
}

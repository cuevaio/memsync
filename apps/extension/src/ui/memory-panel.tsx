import { Button } from "@memsync/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@memsync/ui/card";
import type { ExtensionAuthSnapshot } from "@memsync/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@memsync/ui/tabs";
import { getProviderLabel, type ProviderId } from "../lib/providers";
import type { SharedCache } from "../lib/storage";

type MemoryPanelProps = {
	screen: "main" | "settings";
	currentProvider: ProviderId | null;
	activeTab: ProviderId;
	cache: SharedCache | null;
	errors: Partial<Record<ProviderId, string>>;
	loadingProvider: ProviderId | null;
	busyAction: string | null;
	scheduleBusy: boolean;
	authState: ExtensionAuthSnapshot | null;
	authBusy: "save" | "refresh" | "clear" | null;
	tokenInput: string;
	scheduleError?: string | null;
	onTabChange: (provider: ProviderId) => void;
	onOpenSettings: () => void;
	onBack: () => void;
	onOpenApp: () => void;
	onTokenInputChange: (value: string) => void;
	onSaveToken: () => void;
	onRefreshAuth: () => void;
	onClearAuth: () => void;
	onSyncClaudeToChatGpt: () => void;
	onSyncChatGptToClaude: () => void;
	onToggleScheduledSync: (enabled: boolean) => void;
	unsupportedDescription?: string;
	liveActionsEnabled?: boolean;
};

type ProviderTone = {
	shellClassName: string;
	sectionClassName: string;
	subtleSectionClassName: string;
	titleClassName: string;
	secondaryTextClassName: string;
	settingsButtonClassName: string;
	backButtonClassName: string;
	toggleButtonClassName: string;
	footerButtonClassName: string;
	claudeTabClassName: string;
	chatGptTabClassName: string;
	scrollClassName: string;
	tabListClassName: string;
	dividerClassName: string;
};

function formatRelativeTime(value: string | null | undefined) {
	if (!value) {
		return "Not refreshed yet";
	}

	const timestamp = new Date(value).getTime();
	if (Number.isNaN(timestamp)) {
		return "Cached";
	}

	const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
	if (diffMinutes < 1) {
		return "Updated just now";
	}

	if (diffMinutes < 60) {
		return `Updated ${diffMinutes}m ago`;
	}

	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) {
		return `Updated ${diffHours}h ago`;
	}

	const diffDays = Math.round(diffHours / 24);
	return `Updated ${diffDays}d ago`;
}

function formatScheduleTime(
	value: string | null | undefined,
	emptyLabel: string,
) {
	if (!value) {
		return emptyLabel;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return emptyLabel;
	}

	return date.toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function getAuthSummary(authState: ExtensionAuthSnapshot | null) {
	if (!authState || authState.status === "anonymous") {
		return "Not authenticated yet";
	}

	if (authState.status === "authenticated") {
		return authState.userEmail ? `Authenticated as ${authState.userEmail}` : "Authenticated";
	}

	if (authState.status === "subscription_required") {
		return "Subscription required";
	}

	if (authState.status === "verifying") {
		return "Verifying token...";
	}

	return "Token needs attention";
}

function ProviderView({
	provider,
	cache,
	isLoading,
	error,
	tone,
}: {
	provider: ProviderId;
	cache?: SharedCache["providers"][ProviderId];
	isLoading: boolean;
	error?: string;
	tone: ProviderTone;
}) {
	return (
		<section className={tone.sectionClassName}>
			<div className="flex items-center justify-between gap-2">
				<h3 className="font-medium text-sm text-foreground/90">
					{getProviderLabel(provider)}
				</h3>
				<span className="text-[11px] text-muted-foreground">
					{isLoading ? "Refreshing..." : formatRelativeTime(cache?.fetchedAt)}
				</span>
			</div>

			{error ? (
				<div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
					{error}
				</div>
			) : null}

			<div className={tone.scrollClassName}>
				{isLoading && !cache ? (
					<div className="text-sm text-muted-foreground">
						Loading live data...
					</div>
				) : provider === "claude" ? (
					<div className="whitespace-pre-wrap text-sm leading-6">
						{cache?.native.summaryText || "No Claude summary cached."}
					</div>
				) : cache?.items.length ? (
					<ul className="space-y-3">
						{cache.items.map((item) => (
							<li
								key={item.id}
								className="text-sm leading-6 text-foreground/90"
							>
								{item.text}
							</li>
						))}
					</ul>
				) : (
					<div className="text-sm text-muted-foreground">
						No ChatGPT memories cached.
					</div>
				)}
			</div>
		</section>
	);
}

function getProviderTone(currentProvider: ProviderId | null): ProviderTone {
	if (currentProvider === "claude") {
		return {
			shellClassName:
				"border-[#d7ccc0] bg-[#f7f3ee] text-[#2b241d] shadow-[0_18px_40px_rgba(68,52,29,0.08)]",
			sectionClassName:
				"flex min-h-0 flex-1 flex-col gap-2.5 rounded-[18px] border border-[#e0d5c6] bg-[#fffdfb] px-3 py-3",
			subtleSectionClassName:
				"rounded-[18px] border border-[#e5dacb] bg-[#fbf7f2] px-3 py-3",
			titleClassName: "text-[#2b241d]",
			secondaryTextClassName: "text-[#7d6a57]",
			settingsButtonClassName:
				"border-[#d8c7ae] bg-[#fffaf4] text-[#7a5735] hover:bg-[#f8efe4] hover:text-[#5d4127]",
			backButtonClassName:
				"border-[#d8c7ae] bg-[#fffaf4] text-[#7a5735] hover:bg-[#f8efe4] hover:text-[#5d4127]",
			toggleButtonClassName:
				"border-[#d8c7ae] bg-[#fffaf4] text-[#7a5735] hover:bg-[#f8efe4] hover:text-[#5d4127]",
      footerButtonClassName:
        "bg-[#2b221a] text-[#fff8ef] hover:bg-[#3a2d22] disabled:bg-[#b8aa96] disabled:text-[#fff8ef]",
      claudeTabClassName:
        "text-[#7d6a57] data-[state=active]:border-[#2b221a] data-[state=active]:bg-[#2b221a] data-[state=active]:text-[#fff8ef] data-[state=active]:shadow-none",
      chatGptTabClassName:
        "text-[#7d6a57] data-[state=active]:border-[#2b221a] data-[state=active]:bg-[#2b221a] data-[state=active]:text-[#fff8ef] data-[state=active]:shadow-none",
			scrollClassName:
				"min-h-0 flex-1 overflow-y-auto rounded-xl bg-transparent px-1 py-1 text-sm",
			tabListClassName:
				"grid h-11 w-full min-w-0 grid-cols-2 overflow-hidden rounded-2xl border border-[#e2d7ca] bg-[#f1ebe5] p-1 shadow-none",
			dividerClassName: "border-[#ece3d8]",
		};
	}

	return {
		shellClassName:
			"border-[#d8d8d8] bg-[#ffffff] text-[#0d0d0d] shadow-[0_18px_40px_rgba(13,13,13,0.08)]",
		sectionClassName:
			"flex min-h-0 flex-1 flex-col gap-2.5 rounded-[18px] border border-[#0d0d0d1a] bg-[#ffffff] px-3 py-3",
		subtleSectionClassName:
			"rounded-[18px] border border-[#0d0d0d1a] bg-[#f9f9f9] px-3 py-3",
		titleClassName: "text-[#0d0d0d]",
		secondaryTextClassName: "text-[#5d5d5d]",
		settingsButtonClassName:
			"border-[#0d0d0d1a] bg-[#ffffff] text-[#0d0d0d] hover:bg-[#f9f9f9] hover:text-[#0d0d0d]",
		backButtonClassName:
			"border-[#0d0d0d1a] bg-[#ffffff] text-[#0d0d0d] hover:bg-[#f9f9f9] hover:text-[#0d0d0d]",
		toggleButtonClassName:
			"border-[#0d0d0d1a] bg-[#ffffff] text-[#0d0d0d] hover:bg-[#f9f9f9] hover:text-[#0d0d0d]",
		footerButtonClassName:
			"bg-[#0d0d0d] text-[#ffffff] hover:bg-[#0d0d0dcc] disabled:bg-[#0d0d0d33] disabled:text-[#ffffff]",
		claudeTabClassName:
			"text-[#5d5d5d] data-[state=active]:border-[#0d0d0d] data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-[#ffffff] data-[state=active]:shadow-none",
		chatGptTabClassName:
			"text-[#5d5d5d] data-[state=active]:border-[#0d0d0d] data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-[#ffffff] data-[state=active]:shadow-none",
		scrollClassName:
			"min-h-0 flex-1 overflow-y-auto rounded-xl bg-transparent px-1 py-1 text-sm",
		tabListClassName:
			"grid h-11 w-full min-w-0 grid-cols-2 overflow-hidden rounded-2xl border border-[#0d0d0d1a] bg-[#f3f3f3] p-1 shadow-none",
		dividerClassName: "border-[#0d0d0d0d]",
	};
}

function SettingsView({
	tone,
	schedule,
	scheduleBusy,
	authState,
	authBusy,
	tokenInput,
	scheduleError,
	onToggleScheduledSync,
	onBack,
	onOpenApp,
	onTokenInputChange,
	onSaveToken,
	onRefreshAuth,
	onClearAuth,
}: {
	tone: ProviderTone;
	schedule: SharedCache["schedule"] | undefined;
	scheduleBusy: boolean;
	authState: ExtensionAuthSnapshot | null;
	authBusy: "save" | "refresh" | "clear" | null;
	tokenInput: string;
	scheduleError?: string | null;
	onToggleScheduledSync: (enabled: boolean) => void;
	onBack: () => void;
	onOpenApp: () => void;
	onTokenInputChange: (value: string) => void;
	onSaveToken: () => void;
	onRefreshAuth: () => void;
	onClearAuth: () => void;
}) {
	const latestRunFailed =
		!!schedule?.lastError &&
		!!schedule?.lastRunAt &&
		(!schedule.lastSuccessAt || new Date(schedule.lastSuccessAt).getTime() < new Date(schedule.lastRunAt).getTime());
	const syncEnabled = authState?.status === "authenticated";

	return (
		<>
			<CardHeader className="shrink-0 px-4 pb-3 pt-4">
				<div className="flex items-center justify-between gap-3">
					<div className="space-y-1">
						<CardTitle
							className={`text-[1.45rem] font-semibold tracking-tight ${tone.titleClassName}`}
						>
							Settings
						</CardTitle>
						<CardDescription
							className={`text-sm ${tone.secondaryTextClassName}`}
						>
							Scheduled sync
						</CardDescription>
					</div>

					<Button
						type="button"
						variant="outline"
						size="sm"
						className={`h-9 rounded-full px-4 text-sm shadow-none ${tone.backButtonClassName}`}
						onClick={onBack}
					>
						Go Back
					</Button>
				</div>
			</CardHeader>

			<CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 text-sm">
				<section className={tone.subtleSectionClassName}>
					<div className="flex items-start justify-between gap-3">
						<div>
							<h3 className="font-medium text-sm text-foreground/90">Extension authentication</h3>
							<p className={`pt-1 text-[12px] ${tone.secondaryTextClassName}`}>{getAuthSummary(authState)}</p>
						</div>

						<Button
							type="button"
							variant="outline"
							size="sm"
							className={`h-9 rounded-full px-4 text-sm shadow-none ${tone.toggleButtonClassName}`}
							onClick={onOpenApp}
						>
							Open app
						</Button>
					</div>

					<div className="mt-4 space-y-3 border-t border-border/60 pt-4">
						<label className="block space-y-2">
							<span className={tone.secondaryTextClassName}>Paste the token generated from the app</span>
							<input
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={tokenInput}
								onChange={event => onTokenInputChange(event.target.value)}
								placeholder="msx_..."
							/>
						</label>

						<div className="flex flex-wrap gap-2">
							<Button type="button" size="sm" className="rounded-full px-4" disabled={!tokenInput.trim() || authBusy === "save"} onClick={onSaveToken}>
								{authBusy === "save" ? "Saving..." : "Save token"}
							</Button>
							<Button type="button" variant="outline" size="sm" className={`rounded-full px-4 shadow-none ${tone.toggleButtonClassName}`} disabled={authBusy === "refresh"} onClick={onRefreshAuth}>
								{authBusy === "refresh" ? "Checking..." : "Refresh status"}
							</Button>
							<Button type="button" variant="outline" size="sm" className={`rounded-full px-4 shadow-none ${tone.toggleButtonClassName}`} disabled={!authState?.token || authBusy === "clear"} onClick={onClearAuth}>
								{authBusy === "clear" ? "Clearing..." : "Clear token"}
							</Button>
						</div>

						{authState?.lastError ? (
							<div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
								{authState.lastError}
							</div>
						) : null}
					</div>
				</section>

				<section className={tone.subtleSectionClassName}>
					<div className="flex items-center justify-between gap-3">
						<div>
							<h3 className="font-medium text-sm text-foreground/90">
								Scheduled sync
							</h3>
							<p className={`pt-1 text-[12px] ${tone.secondaryTextClassName}`}>
								{schedule?.enabled
									? `On every ${schedule.intervalHours}h`
									: "Off"}
							</p>
						</div>

						<Button
							type="button"
							variant="outline"
							size="sm"
							className={`h-9 rounded-full px-4 text-sm shadow-none ${tone.toggleButtonClassName}`}
							onClick={() =>
								onToggleScheduledSync(!(schedule?.enabled ?? true))
							}
							disabled={scheduleBusy || !syncEnabled}
						>
							{scheduleBusy
								? "Saving"
								: schedule?.enabled
									? "Turn off"
									: "Turn on"}
						</Button>
					</div>

					{!syncEnabled ? (
						<p className={`mt-3 text-[12px] ${tone.secondaryTextClassName}`}>
							Authenticate the extension first before enabling scheduled sync.
						</p>
					) : null}

					<div
						className={`mt-4 space-y-3 border-t pt-4 text-sm ${tone.dividerClassName}`}
					>
						<div className="flex items-center justify-between gap-3">
							<span className={tone.secondaryTextClassName}>Last run</span>
							<span className="text-right text-foreground/80">
								{formatScheduleTime(schedule?.lastRunAt, "Never")}
							</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className={tone.secondaryTextClassName}>Last success</span>
							<span className="text-right text-foreground/80">
								{formatScheduleTime(schedule?.lastSuccessAt, "Never")}
							</span>
						</div>
					</div>

					{latestRunFailed ? (
						<div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
							{schedule.lastError}
						</div>
					) : null}

					{scheduleError ? (
						<div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
							{scheduleError}
						</div>
					) : null}
				</section>
			</CardContent>
		</>
	);
}

export function MemoryPanel({
	screen,
	currentProvider,
	activeTab,
	cache,
	errors,
	loadingProvider,
	busyAction,
	scheduleBusy,
	authState,
	authBusy,
	tokenInput,
	scheduleError,
	onTabChange,
	onOpenSettings,
	onBack,
	onOpenApp,
	onTokenInputChange,
	onSaveToken,
	onRefreshAuth,
	onClearAuth,
	onSyncClaudeToChatGpt,
	onSyncChatGptToClaude,
	onToggleScheduledSync,
	unsupportedDescription,
	liveActionsEnabled = true,
}: MemoryPanelProps) {
	const claudeCache = cache?.providers.claude;
	const chatGptCache = cache?.providers.chatgpt;
	const tone = getProviderTone(currentProvider);

	const schedule = cache?.schedule;

	if (screen === "settings") {
		return (
			<Card
				className={`flex h-full w-full flex-col gap-0 overflow-hidden rounded-[24px] py-0 ${tone.shellClassName}`}
			>
				<SettingsView
					tone={tone}
					schedule={schedule}
					scheduleBusy={scheduleBusy}
					authState={authState}
					authBusy={authBusy}
					tokenInput={tokenInput}
					scheduleError={scheduleError}
					onToggleScheduledSync={onToggleScheduledSync}
					onBack={onBack}
					onOpenApp={onOpenApp}
					onTokenInputChange={onTokenInputChange}
					onSaveToken={onSaveToken}
					onRefreshAuth={onRefreshAuth}
					onClearAuth={onClearAuth}
				/>
			</Card>
		);
	}

	return (
		<Card
			className={`flex h-full w-full flex-col gap-0 overflow-hidden rounded-[24px] py-0 ${tone.shellClassName}`}
		>
			<CardHeader className="shrink-0 px-4 pb-3 pt-4">
				<div className="flex items-center justify-between gap-3">
					<div className="space-y-1">
						<CardTitle
							className={`text-[1.55rem] font-semibold tracking-tight ${tone.titleClassName}`}
						>
							Memory Sync
						</CardTitle>
					</div>

					<Button
						type="button"
						variant="outline"
						size="sm"
						className={`h-9 rounded-full px-4 text-sm shadow-none ${tone.settingsButtonClassName}`}
						onClick={onOpenSettings}
					>
						Settings
					</Button>
				</div>

				{!currentProvider && unsupportedDescription ? (
					<p
						className={`pt-2 text-sm leading-5 ${tone.secondaryTextClassName}`}
					>
						{unsupportedDescription}
					</p>
				) : null}

				{authState?.status !== "authenticated" ? (
					<div className="mt-4 rounded-2xl border border-dashed border-border bg-background/70 px-4 py-3">
						<p className="text-sm font-medium text-foreground">Authenticate the extension</p>
						<p className={`mt-1 text-sm leading-5 ${tone.secondaryTextClassName}`}>
							Open the app, sign in, generate a token, then paste it in Settings.
						</p>
						<div className="mt-3">
							<Button type="button" size="sm" onClick={onOpenApp}>
								Open app
							</Button>
						</div>
					</div>
				) : null}
			</CardHeader>

			<CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 text-sm">
				<Tabs
					value={activeTab}
					onValueChange={(value) => onTabChange(value as ProviderId)}
					className="flex min-h-0 flex-1 flex-col gap-3"
				>
					<TabsList className={tone.tabListClassName}>
						<TabsTrigger
							value="claude"
							className={`h-full min-w-0 overflow-hidden rounded-[10px] px-2 text-sm font-medium ${tone.claudeTabClassName}`}
						>
							Claude
						</TabsTrigger>
						<TabsTrigger
							value="chatgpt"
							className={`h-full min-w-0 overflow-hidden rounded-[10px] px-2 text-sm font-medium ${tone.chatGptTabClassName}`}
						>
							ChatGPT
						</TabsTrigger>
					</TabsList>

					<TabsContent
						value="claude"
						className="mt-0 flex min-h-0 flex-1 outline-none"
					>
						<ProviderView
							provider="claude"
							cache={claudeCache}
							isLoading={loadingProvider === "claude"}
							error={errors.claude}
							tone={tone}
						/>
					</TabsContent>
					<TabsContent
						value="chatgpt"
						className="mt-0 flex min-h-0 flex-1 outline-none"
					>
						<ProviderView
							provider="chatgpt"
							cache={chatGptCache}
							isLoading={loadingProvider === "chatgpt"}
							error={errors.chatgpt}
							tone={tone}
						/>
					</TabsContent>
				</Tabs>
			</CardContent>

			<CardFooter className="shrink-0 px-4 pb-4 pt-0">
				{currentProvider === "claude" ? (
					<div className="w-full space-y-2">
						<Button
							type="button"
							className={`h-11 w-full rounded-xl px-4 text-sm font-semibold whitespace-normal text-center ${tone.footerButtonClassName}`}
							onClick={onSyncChatGptToClaude}
							disabled={
								!liveActionsEnabled ||
								!chatGptCache ||
								busyAction === "chatgptToClaude"
							}
						>
							{busyAction === "chatgptToClaude"
								? "Syncing to Claude..."
								: "Sync ChatGPT to Claude"}
						</Button>
					</div>
				) : null}

				{currentProvider === "chatgpt" ? (
					<div className="w-full space-y-2">
						<Button
							type="button"
							className={`h-11 w-full rounded-xl px-4 text-sm font-semibold whitespace-normal text-center ${tone.footerButtonClassName}`}
							onClick={onSyncClaudeToChatGpt}
							disabled={
								!liveActionsEnabled ||
								!claudeCache ||
								busyAction === "claudeToChatgpt"
							}
						>
							{busyAction === "claudeToChatgpt"
								? "Syncing to ChatGPT..."
								: "Sync Claude to ChatGPT"}
						</Button>
					</div>
				) : null}

				{!currentProvider ? (
					<div className="w-full rounded-xl border border-dashed border-border/80 bg-background/60 px-4 py-3 text-center text-muted-foreground text-sm">
						Open Claude or ChatGPT to enable syncing.
					</div>
				) : null}
			</CardFooter>
		</Card>
	);
}

/** English regions use rendered row geometry; Hanzi navigation has its own rules. */
export function roving(host: HTMLElement, labels: string[], makeButton: (label: string, index: number) => HTMLButtonElement): void {
    const old = host.querySelector<HTMLButtonElement>('button[tabindex="0"]');
    const oldIndex = old ? Number(old.dataset.position) : 0;
    const focusIndex = host.contains(document.activeElement) ? Number((document.activeElement as HTMLElement).dataset.position ?? oldIndex) : -1;
    host.replaceChildren();
    labels.forEach((label, index) => {
      const button = makeButton(label, index); button.dataset.position = String(index);
      button.tabIndex = index === Math.min(oldIndex, labels.length - 1) ? 0 : -1;
      host.append(button);
    });
    host.onkeydown = event => {
      if (!(event instanceof KeyboardEvent) || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const current = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-position]');
      if (!current || !host.contains(current)) return;
      event.preventDefault();
      const buttons = [...host.querySelectorAll<HTMLButtonElement>('button[data-position]')];
      const index = Number(current.dataset.position);
      let next = index;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
      else {
        const boxes = buttons.map(button => button.getBoundingClientRect());
        const y = boxes[index].top;
        const rows = [...new Set(boxes.map(box => Math.round(box.top)))].sort((a, b) => a - b);
        const row = rows.findIndex(top => Math.abs(top - y) < 3);
        const targetY = rows[Math.max(0, Math.min(rows.length - 1, row + (event.key === 'ArrowDown' ? 1 : -1)))];
        const center = (boxes[index].left + boxes[index].right) / 2;
        const candidates = boxes.map((box, position) => ({ box, position })).filter(item => Math.abs(item.box.top - targetY) < 3);
        next = candidates.sort((a, b) => Math.abs((a.box.left + a.box.right) / 2 - center) - Math.abs((b.box.left + b.box.right) / 2 - center))[0]?.position ?? index;
      }
      current.tabIndex = -1; buttons[next].tabIndex = 0; buttons[next].focus();
    };
    if (focusIndex >= 0) host.querySelector<HTMLButtonElement>(`button[data-position="${focusIndex}"]`)?.focus();
  }

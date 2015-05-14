/* 
 * Moves the mouse cursor periodically to prevent the system from going to sleep.
 * Usage: javaw MoveMouseToPreventSleep
 */

import java.awt.AWTException;
import java.awt.Robot;


public class MoveMouseToPreventSleep {
	
	public static void main(String[] args) throws AWTException, InterruptedException {
		Robot rob = new Robot();
		int i = 0;
		while (true) {
			rob.mouseMove(i, i);
			Thread.sleep(60000);
			i ^= 1;
		}
	}
	
}
